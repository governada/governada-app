import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { PRIORITY_AREAS } from '@/lib/api/schemas/engagement';

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

/**
 * Precompute engagement signal aggregations.
 * Runs every 2 hours + on-demand via event.
 *
 * Aggregates: sentiment, concern flags, impact tags, priority rankings, assembly results.
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

    // Step 1: Aggregate sentiment per proposal
    const sentimentStats = await step.run('aggregate-sentiment', async () => {
      const sentiments = await fetchAllBatched<{
        proposal_tx_hash: string;
        proposal_index: number;
        sentiment: string;
        delegated_drep_id: string | null;
      }>(() =>
        supabase
          .from('citizen_sentiment')
          .select('proposal_tx_hash, proposal_index, sentiment, delegated_drep_id'),
      );

      if (sentiments.length === 0) return { proposals: 0 };

      // Group by proposal
      const byProposal = new Map<
        string,
        {
          support: number;
          oppose: number;
          unsure: number;
          total: number;
          dreps: Map<string, { support: number; oppose: number; unsure: number; total: number }>;
        }
      >();

      for (const s of sentiments) {
        const key = `${s.proposal_tx_hash}:${s.proposal_index}`;
        if (!byProposal.has(key)) {
          byProposal.set(key, { support: 0, oppose: 0, unsure: 0, total: 0, dreps: new Map() });
        }
        const agg = byProposal.get(key)!;
        agg.total++;
        if (s.sentiment === 'support') agg.support++;
        else if (s.sentiment === 'oppose') agg.oppose++;
        else agg.unsure++;

        // Per-DRep aggregation
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

    // Step 2: Aggregate concern flags per proposal
    const concernStats = await step.run('aggregate-concerns', async () => {
      const flags = await fetchAllBatched<{
        proposal_tx_hash: string;
        proposal_index: number;
        flag_type: string;
      }>(() =>
        supabase
          .from('citizen_concern_flags')
          .select('proposal_tx_hash, proposal_index, flag_type'),
      );

      if (flags.length === 0) return { proposals: 0 };

      const byProposal = new Map<string, Record<string, number>>();
      for (const f of flags) {
        const key = `${f.proposal_tx_hash}:${f.proposal_index}`;
        if (!byProposal.has(key)) byProposal.set(key, {});
        const agg = byProposal.get(key)!;
        agg[f.flag_type] = (agg[f.flag_type] || 0) + 1;
      }

      const rows = [...byProposal.entries()].map(([key, flagCounts]) => ({
        entity_type: 'proposal' as const,
        entity_id: key,
        signal_type: 'concern_flags' as const,
        data: flagCounts,
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

    // Step 4: Compute priority rankings for current epoch
    const priorityStats = await step.run('compute-priority-rankings', async () => {
      const { data: signals } = await supabase
        .from('citizen_priority_signals')
        .select('ranked_priorities')
        .eq('epoch', currentEpoch);

      if (!signals || signals.length === 0) return { voters: 0 };

      const maxPoints = 5;
      const scores: Record<string, number> = {};
      const firstChoiceCounts: Record<string, number> = {};
      for (const area of PRIORITY_AREAS) {
        scores[area] = 0;
        firstChoiceCounts[area] = 0;
      }

      for (const s of signals) {
        const ranking = s.ranked_priorities;
        for (let i = 0; i < ranking.length; i++) {
          scores[ranking[i]] = (scores[ranking[i]] || 0) + (maxPoints - i);
          if (i === 0) firstChoiceCounts[ranking[i]] = (firstChoiceCounts[ranking[i]] || 0) + 1;
        }
      }

      const rankings = Object.entries(scores)
        .map(([priority, score]) => ({
          priority,
          score,
          rank: 0,
          firstChoiceCount: firstChoiceCounts[priority] || 0,
        }))
        .sort((a, b) => b.score - a.score)
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

    // Step 5: Close expired assemblies
    const assemblyStats = await step.run('close-expired-assemblies', async () => {
      const now = new Date().toISOString();
      const { data: expired } = await supabase
        .from('citizen_assemblies')
        .select('id, options')
        .eq('status', 'active')
        .lt('closes_at', now);

      if (!expired || expired.length === 0) return { closed: 0 };

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
        const options = (assembly.options as { key: string; label: string }[]) || [];
        const results = options.map((opt) => ({
          key: opt.key,
          label: opt.label,
          count: voteCounts[opt.key] || 0,
          percentage:
            totalVotes > 0 ? Math.round(((voteCounts[opt.key] || 0) / totalVotes) * 100) : 0,
        }));

        await supabase
          .from('citizen_assemblies')
          .update({
            status: 'closed',
            results,
            total_votes: totalVotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assembly.id);
      }

      return { closed: expired.length };
    });

    // Step 6: Log sync
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
        },
      });
    });

    return {
      sentimentStats,
      concernStats,
      impactStats,
      priorityStats,
      assemblyStats,
    };
  },
);
