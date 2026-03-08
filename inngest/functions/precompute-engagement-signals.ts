import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { PRIORITY_AREAS } from '@/lib/api/schemas/engagement';
import { computeCredibilityBatch } from '@/lib/citizenCredibility';

const BATCH_SIZE = 5000;

/** Fetch all rows from a table in batches to avoid PostgREST 1000-row default limit. */
async function fetchAllBatched<T>(
  query: () => ReturnType<ReturnType<SupabaseClient['from']>['select']>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await query().range(offset, offset + BATCH_SIZE - 1);
    if (error) {
      logger.error('Batched fetch error', { error: error.message });
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
  return all;
}

// -- Anomaly detection helpers --

interface AnomalyFlags {
  allSameDirection: string[];
  highVolume: string[];
}

/** Detect users whose signals look suspicious. */
function detectAnomalies(
  sentiments: { user_id: string; sentiment: string }[],
  concernFlags: { user_id: string }[],
): AnomalyFlags {
  const flags: AnomalyFlags = { allSameDirection: [], highVolume: [] };

  // All votes same direction across all proposals
  const userSentiments = new Map<string, Set<string>>();
  const userSentimentCount = new Map<string, number>();
  for (const s of sentiments) {
    if (!userSentiments.has(s.user_id)) userSentiments.set(s.user_id, new Set());
    userSentiments.get(s.user_id)!.add(s.sentiment);
    userSentimentCount.set(s.user_id, (userSentimentCount.get(s.user_id) ?? 0) + 1);
  }

  for (const [userId, sentimentSet] of userSentiments) {
    const count = userSentimentCount.get(userId) ?? 0;
    // Flag: 10+ votes, all same direction (excluding unsure)
    if (count >= 10 && sentimentSet.size === 1 && !sentimentSet.has('unsure')) {
      flags.allSameDirection.push(userId);
    }
  }

  // Concern flag volume per user
  const userFlagCounts = new Map<string, number>();
  for (const f of concernFlags) {
    userFlagCounts.set(f.user_id, (userFlagCounts.get(f.user_id) ?? 0) + 1);
  }
  for (const [userId, count] of userFlagCounts) {
    if (count >= 15) flags.highVolume.push(userId);
  }

  return flags;
}

/**
 * Precompute engagement signal aggregations.
 * Runs every 2 hours + on-demand via event.
 *
 * Aggregates: sentiment, concern flags, impact tags, priority rankings, assembly results.
 * Includes credibility-weighted scores alongside raw counts.
 * Writes to `engagement_signal_aggregations` and `citizen_priority_rankings`.
 */
export const precomputeEngagementSignals = inngest.createFunction(
  {
    id: 'precompute-engagement-signals',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"engagement-signals"' },
  },
  [{ cron: '0 */2 * * *' }, { event: 'drepscore/engagement.precompute' }],
  async ({ step }) => {
    const supabase = getSupabaseAdmin();
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Step 1: Aggregate sentiment per proposal (raw + weighted)
    const sentimentStats = await step.run('aggregate-sentiment', async () => {
      const sentiments = await fetchAllBatched<{
        proposal_tx_hash: string;
        proposal_index: number;
        sentiment: string;
        delegated_drep_id: string | null;
        user_id: string;
      }>(() =>
        supabase
          .from('citizen_sentiment')
          .select('proposal_tx_hash, proposal_index, sentiment, delegated_drep_id, user_id'),
      );

      if (sentiments.length === 0) return { proposals: 0 };

      // Compute credibility weights for all users who voted
      const userIds = [...new Set(sentiments.map((s) => s.user_id))];
      const credWeights = await computeCredibilityBatch(userIds);

      // Group by proposal
      const byProposal = new Map<
        string,
        {
          support: number;
          oppose: number;
          unsure: number;
          total: number;
          weightedSupport: number;
          weightedOppose: number;
          weightedUnsure: number;
          weightedTotal: number;
          dreps: Map<string, { support: number; oppose: number; unsure: number; total: number }>;
        }
      >();

      for (const s of sentiments) {
        const key = `${s.proposal_tx_hash}:${s.proposal_index}`;
        if (!byProposal.has(key)) {
          byProposal.set(key, {
            support: 0,
            oppose: 0,
            unsure: 0,
            total: 0,
            weightedSupport: 0,
            weightedOppose: 0,
            weightedUnsure: 0,
            weightedTotal: 0,
            dreps: new Map(),
          });
        }
        const agg = byProposal.get(key)!;
        const weight = credWeights.get(s.user_id) ?? 0.1;

        agg.total++;
        agg.weightedTotal += weight;
        if (s.sentiment === 'support') {
          agg.support++;
          agg.weightedSupport += weight;
        } else if (s.sentiment === 'oppose') {
          agg.oppose++;
          agg.weightedOppose += weight;
        } else {
          agg.unsure++;
          agg.weightedUnsure += weight;
        }

        // Per-DRep aggregation (raw counts only — DRep alignment doesn't need weighting)
        if (s.delegated_drep_id) {
          if (!agg.dreps.has(s.delegated_drep_id)) {
            agg.dreps.set(s.delegated_drep_id, { support: 0, oppose: 0, unsure: 0, total: 0 });
          }
          const drep = agg.dreps.get(s.delegated_drep_id)!;
          drep.total++;
          if (s.sentiment === 'support') drep.support++;
          else if (s.sentiment === 'oppose') drep.oppose++;
          else drep.unsure++;
        }
      }

      // Upsert aggregations
      const rows = [];
      for (const [key, agg] of byProposal) {
        rows.push({
          entity_type: 'proposal' as const,
          entity_id: key,
          signal_type: 'sentiment' as const,
          data: {
            support: agg.support,
            oppose: agg.oppose,
            unsure: agg.unsure,
            total: agg.total,
            weighted: {
              support: Math.round(agg.weightedSupport * 100) / 100,
              oppose: Math.round(agg.weightedOppose * 100) / 100,
              unsure: Math.round(agg.weightedUnsure * 100) / 100,
              total: Math.round(agg.weightedTotal * 100) / 100,
            },
          },
          epoch: currentEpoch,
          computed_at: new Date().toISOString(),
        });

        // Per-DRep entries
        for (const [drepId, drepAgg] of agg.dreps) {
          rows.push({
            entity_type: 'drep' as const,
            entity_id: drepId,
            signal_type: 'sentiment' as const,
            data: {
              proposal: key,
              ...drepAgg,
            },
            epoch: currentEpoch,
            computed_at: new Date().toISOString(),
          });
        }
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('engagement_signal_aggregations')
          .upsert(rows, { onConflict: 'entity_type,entity_id,signal_type,epoch' });

        if (error) {
          logger.error('Failed to upsert sentiment aggregations', { error: error.message });
        }
      }

      return { proposals: byProposal.size };
    });

    // Step 2: Aggregate concern flags per proposal (raw + weighted)
    const concernStats = await step.run('aggregate-concerns', async () => {
      const flags = await fetchAllBatched<{
        proposal_tx_hash: string;
        proposal_index: number;
        flag_type: string;
        user_id: string;
      }>(() =>
        supabase
          .from('citizen_concern_flags')
          .select('proposal_tx_hash, proposal_index, flag_type, user_id'),
      );

      if (flags.length === 0) return { proposals: 0 };

      // Compute credibility weights
      const userIds = [...new Set(flags.map((f) => f.user_id))];
      const credWeights = await computeCredibilityBatch(userIds);

      const byProposal = new Map<
        string,
        { raw: Record<string, number>; weighted: Record<string, number> }
      >();
      for (const f of flags) {
        const key = `${f.proposal_tx_hash}:${f.proposal_index}`;
        if (!byProposal.has(key)) byProposal.set(key, { raw: {}, weighted: {} });
        const agg = byProposal.get(key)!;
        const weight = credWeights.get(f.user_id) ?? 0.1;
        agg.raw[f.flag_type] = (agg.raw[f.flag_type] || 0) + 1;
        agg.weighted[f.flag_type] =
          Math.round(((agg.weighted[f.flag_type] || 0) + weight) * 100) / 100;
      }

      const rows = [...byProposal.entries()].map(([key, agg]) => ({
        entity_type: 'proposal' as const,
        entity_id: key,
        signal_type: 'concern_flags' as const,
        data: { ...agg.raw, weighted: agg.weighted },
        epoch: currentEpoch,
        computed_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await supabase
          .from('engagement_signal_aggregations')
          .upsert(rows, { onConflict: 'entity_type,entity_id,signal_type,epoch' });
      }

      return { proposals: byProposal.size };
    });

    // Step 3: Aggregate impact tags per proposal
    const impactStats = await step.run('aggregate-impact', async () => {
      const tags = await fetchAllBatched<{
        proposal_tx_hash: string;
        proposal_index: number;
        awareness: string;
        rating: string;
      }>(() =>
        supabase
          .from('citizen_impact_tags')
          .select('proposal_tx_hash, proposal_index, awareness, rating'),
      );

      if (tags.length === 0) return { proposals: 0 };

      const byProposal = new Map<
        string,
        { awareness: Record<string, number>; ratings: Record<string, number>; total: number }
      >();
      for (const t of tags) {
        const key = `${t.proposal_tx_hash}:${t.proposal_index}`;
        if (!byProposal.has(key)) {
          byProposal.set(key, { awareness: {}, ratings: {}, total: 0 });
        }
        const agg = byProposal.get(key)!;
        agg.total++;
        agg.awareness[t.awareness] = (agg.awareness[t.awareness] || 0) + 1;
        agg.ratings[t.rating] = (agg.ratings[t.rating] || 0) + 1;
      }

      const rows = [...byProposal.entries()].map(([key, agg]) => ({
        entity_type: 'proposal' as const,
        entity_id: key,
        signal_type: 'impact_tags' as const,
        data: agg,
        epoch: currentEpoch,
        computed_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        await supabase
          .from('engagement_signal_aggregations')
          .upsert(rows, { onConflict: 'entity_type,entity_id,signal_type,epoch' });
      }

      return { proposals: byProposal.size };
    });

    // Step 4: Compute priority rankings for current epoch (with weighted Borda)
    const priorityStats = await step.run('compute-priority-rankings', async () => {
      const { data: signals } = await supabase
        .from('citizen_priority_signals')
        .select('ranked_priorities, user_id')
        .eq('epoch', currentEpoch);

      if (!signals || signals.length === 0) return { voters: 0 };

      // Compute credibility weights
      const userIds = signals.map((s) => s.user_id).filter(Boolean);
      const credWeights = await computeCredibilityBatch(userIds);

      const maxPoints = 5;
      const scores: Record<string, number> = {};
      const weightedScores: Record<string, number> = {};
      const firstChoiceCounts: Record<string, number> = {};
      for (const area of PRIORITY_AREAS) {
        scores[area] = 0;
        weightedScores[area] = 0;
        firstChoiceCounts[area] = 0;
      }

      for (const s of signals) {
        const ranking = s.ranked_priorities;
        const weight = credWeights.get(s.user_id) ?? 0.1;
        for (let i = 0; i < ranking.length; i++) {
          const points = maxPoints - i;
          scores[ranking[i]] = (scores[ranking[i]] || 0) + points;
          weightedScores[ranking[i]] = (weightedScores[ranking[i]] || 0) + points * weight;
          if (i === 0) firstChoiceCounts[ranking[i]] = (firstChoiceCounts[ranking[i]] || 0) + 1;
        }
      }

      // Use weighted scores for ranking
      const rankings = Object.entries(weightedScores)
        .map(([priority, wScore]) => ({
          priority,
          score: scores[priority] || 0,
          weightedScore: Math.round(wScore * 100) / 100,
          rank: 0,
          firstChoiceCount: firstChoiceCounts[priority] || 0,
        }))
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .map((item, i) => ({ ...item, rank: i + 1 }));

      await supabase.from('citizen_priority_rankings').upsert(
        {
          epoch: currentEpoch,
          rankings,
          total_voters: signals.length,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'epoch' },
      );

      return { voters: signals.length };
    });

    // Step 5: Close expired assemblies (with quorum check)
    const assemblyStats = await step.run('close-expired-assemblies', async () => {
      const now = new Date().toISOString();
      const { data: expired } = await supabase
        .from('citizen_assemblies')
        .select('id, options, quorum_threshold')
        .eq('status', 'active')
        .lt('closes_at', now);

      if (!expired || expired.length === 0) return { closed: 0, quorumNotMet: 0 };

      let quorumNotMet = 0;

      for (const assembly of expired) {
        const { data: responses } = await supabase
          .from('citizen_assembly_responses')
          .select('selected_option')
          .eq('assembly_id', assembly.id);

        const voteCounts: Record<string, number> = {};
        for (const r of responses || []) {
          voteCounts[r.selected_option] = (voteCounts[r.selected_option] || 0) + 1;
        }

        const totalVotes = (responses || []).length;
        const quorumThreshold = (assembly as { quorum_threshold?: number }).quorum_threshold ?? 0;
        const quorumMet = quorumThreshold <= 0 || totalVotes >= quorumThreshold;

        const options = (assembly.options as { key: string; label: string }[]) || [];
        const results = options.map((opt) => ({
          key: opt.key,
          label: opt.label,
          count: voteCounts[opt.key] || 0,
          percentage:
            totalVotes > 0 ? Math.round(((voteCounts[opt.key] || 0) / totalVotes) * 100) : 0,
        }));

        const status = quorumMet ? 'closed' : 'quorum_not_met';
        if (!quorumMet) quorumNotMet++;

        await supabase
          .from('citizen_assemblies')
          .update({
            status,
            results,
            total_votes: totalVotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assembly.id);
      }

      return { closed: expired.length - quorumNotMet, quorumNotMet };
    });

    // Step 6: Anomaly detection
    const anomalyStats = await step.run('detect-anomalies', async () => {
      // Fetch all sentiments and concern flags for anomaly detection
      const [sentiments, concernFlags] = await Promise.all([
        fetchAllBatched<{ user_id: string; sentiment: string }>(() =>
          supabase.from('citizen_sentiment').select('user_id, sentiment'),
        ),
        fetchAllBatched<{ user_id: string }>(() =>
          supabase.from('citizen_concern_flags').select('user_id'),
        ),
      ]);

      const anomalies = detectAnomalies(sentiments, concernFlags);

      const totalFlagged = anomalies.allSameDirection.length + anomalies.highVolume.length;

      if (totalFlagged > 0) {
        // Store anomaly report as a special aggregation entry for admin visibility
        await supabase.from('engagement_signal_aggregations').upsert(
          {
            entity_type: 'system' as string,
            entity_id: `anomaly-report-${currentEpoch}`,
            signal_type: 'anomaly_flags' as string,
            data: {
              allSameDirection: anomalies.allSameDirection.length,
              highVolumeConcerns: anomalies.highVolume.length,
              flaggedUserIds: [
                ...new Set([...anomalies.allSameDirection, ...anomalies.highVolume]),
              ].slice(0, 50), // Cap stored IDs for privacy
              detectedAt: new Date().toISOString(),
            },
            epoch: currentEpoch,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'entity_type,entity_id,signal_type,epoch' },
        );

        logger.info('Anomalies detected', {
          allSameDirection: anomalies.allSameDirection.length,
          highVolume: anomalies.highVolume.length,
        });
      }

      return { flagged: totalFlagged };
    });

    // Step 7: Aggregate endorsements per entity (raw + weighted)
    const endorsementStats = await step.run('aggregate-endorsements', async () => {
      const endorsements = await fetchAllBatched<{
        entity_type: string;
        entity_id: string;
        endorsement_type: string;
        user_id: string;
      }>(() =>
        supabase
          .from('citizen_endorsements')
          .select('entity_type, entity_id, endorsement_type, user_id'),
      );

      if (endorsements.length === 0) return { entities: 0 };

      // Compute credibility weights for endorsers
      const userIds = [...new Set(endorsements.map((e) => e.user_id))];
      const credWeights = await computeCredibilityBatch(userIds);

      // Group by entity
      const byEntity = new Map<
        string,
        {
          entityType: string;
          entityId: string;
          raw: Record<string, number>;
          weighted: Record<string, number>;
          total: number;
          weightedTotal: number;
        }
      >();

      for (const e of endorsements) {
        const key = `${e.entity_type}:${e.entity_id}`;
        if (!byEntity.has(key)) {
          byEntity.set(key, {
            entityType: e.entity_type,
            entityId: e.entity_id,
            raw: {},
            weighted: {},
            total: 0,
            weightedTotal: 0,
          });
        }
        const agg = byEntity.get(key)!;
        const weight = credWeights.get(e.user_id) ?? 0.1;

        agg.total++;
        agg.weightedTotal += weight;
        agg.raw[e.endorsement_type] = (agg.raw[e.endorsement_type] || 0) + 1;
        agg.weighted[e.endorsement_type] =
          Math.round(((agg.weighted[e.endorsement_type] || 0) + weight) * 100) / 100;
      }

      const rows = [...byEntity.values()].map((agg) => ({
        entity_type: agg.entityType,
        entity_id: agg.entityId,
        signal_type: 'endorsements' as const,
        data: {
          ...agg.raw,
          total: agg.total,
          weighted: { ...agg.weighted, total: Math.round(agg.weightedTotal * 100) / 100 },
        },
        epoch: currentEpoch,
        computed_at: new Date().toISOString(),
      }));

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from('engagement_signal_aggregations')
          .upsert(rows, { onConflict: 'entity_type,entity_id,signal_type,epoch' });

        if (upsertError) {
          logger.error('Failed to upsert endorsement aggregations', {
            error: upsertError.message,
          });
        }
      }

      return { entities: byEntity.size };
    });

    // Step 8: Log sync
    await step.run('log-sync', async () => {
      await supabase.from('sync_log').insert({
        sync_type: 'engagement_signals',
        status: 'success',
        details: {
          sentiment: sentimentStats,
          concerns: concernStats,
          impact: impactStats,
          priorities: priorityStats,
          assemblies: assemblyStats,
          anomalies: anomalyStats,
          endorsements: endorsementStats,
        },
      });
    });

    return {
      sentimentStats,
      concernStats,
      impactStats,
      priorityStats,
      assemblyStats,
      anomalyStats,
      endorsementStats,
    };
  },
);
