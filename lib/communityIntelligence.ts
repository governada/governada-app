/**
 * Community Intelligence — aggregation functions for citizen mandate,
 * sentiment divergence, and governance temperature.
 *
 * All features are gated by feature flags. Data is collected continuously;
 * surfaces are shown only when the corresponding flag is enabled.
 */

import { createClient, getSupabaseAdmin } from './supabase';
import { blockTimeToEpoch } from './koios';
import { logger } from './logger';
import { PRIORITY_AREAS } from '@/lib/api/schemas/engagement';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MandatePriority {
  priority: string;
  label: string;
  score: number;
  weightedScore: number;
  rank: number;
  firstChoiceCount: number;
  totalVoters: number;
  /** Trend vs previous epoch: positive = rising, negative = falling */
  trend: number | null;
}

export interface CitizenMandateResult {
  epoch: number;
  priorities: MandatePriority[];
  totalVoters: number;
  updatedAt: string;
}

export interface ProposalDivergence {
  proposalTxHash: string;
  proposalIndex: number;
  proposalTitle: string | null;
  citizenSentiment: { support: number; oppose: number; unsure: number; total: number };
  drepVote: { yes: number; no: number; abstain: number; total: number };
  divergenceScore: number; // 0..1
}

export interface SentimentDivergenceResult {
  epoch: number;
  proposals: ProposalDivergence[];
  aggregateDivergence: number; // 0..1
  updatedAt: string;
}

export interface GovernanceTemperatureResult {
  epoch: number;
  temperature: number; // 0..100
  components: {
    engagementVolume: number; // 0..25
    sentimentPolarization: number; // 0..25
    proposalVelocity: number; // 0..25
    participationRate: number; // 0..25
  };
  band: 'cold' | 'cool' | 'warm' | 'hot';
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Pretty labels for priority areas
// ---------------------------------------------------------------------------

const PRIORITY_LABELS: Record<string, string> = {
  infrastructure: 'Infrastructure',
  education: 'Education',
  defi: 'DeFi',
  marketing: 'Marketing',
  developer_tooling: 'Developer Tooling',
  governance_tooling: 'Governance Tooling',
  identity_dids: 'Identity & DIDs',
  interoperability: 'Interoperability',
  security_auditing: 'Security & Auditing',
  community_hubs: 'Community Hubs',
  research: 'Research',
  media_content: 'Media & Content',
};

// ---------------------------------------------------------------------------
// 1. Citizen Mandate
// ---------------------------------------------------------------------------

/**
 * Aggregate citizen priority signals into a ranked mandate.
 * Reads from `citizen_priority_rankings` (precomputed by engagement signals job)
 * and falls back to raw `citizen_priority_signals` if no precomputed data exists.
 */
export async function getCitizenMandate(
  targetEpoch?: number,
): Promise<CitizenMandateResult | null> {
  const supabase = createClient();
  const epoch = targetEpoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Try precomputed rankings first
  const { data: precomputed } = await supabase
    .from('citizen_priority_rankings')
    .select('rankings, total_voters, computed_at')
    .eq('epoch', epoch)
    .single();

  if (precomputed && precomputed.rankings) {
    const rankings = precomputed.rankings as Array<{
      priority: string;
      score: number;
      weightedScore: number;
      rank: number;
      firstChoiceCount: number;
    }>;

    // Fetch previous epoch for trend
    const { data: prevRankings } = await supabase
      .from('citizen_priority_rankings')
      .select('rankings')
      .eq('epoch', epoch - 1)
      .single();

    const prevScoreMap = new Map<string, number>();
    if (prevRankings?.rankings) {
      for (const r of prevRankings.rankings as Array<{
        priority: string;
        weightedScore: number;
      }>) {
        prevScoreMap.set(r.priority, r.weightedScore);
      }
    }

    return {
      epoch,
      totalVoters: precomputed.total_voters ?? 0,
      updatedAt: precomputed.computed_at ?? new Date().toISOString(),
      priorities: rankings.map((r) => ({
        priority: r.priority,
        label: PRIORITY_LABELS[r.priority] ?? r.priority,
        score: r.score,
        weightedScore: r.weightedScore,
        rank: r.rank,
        firstChoiceCount: r.firstChoiceCount,
        totalVoters: precomputed.total_voters ?? 0,
        trend: prevScoreMap.has(r.priority)
          ? r.weightedScore - (prevScoreMap.get(r.priority) ?? 0)
          : null,
      })),
    };
  }

  // Fallback: compute from raw signals
  const { data: signals } = await supabase
    .from('citizen_priority_signals')
    .select('ranked_priorities')
    .eq('epoch', epoch);

  if (!signals || signals.length === 0) return null;

  const maxPoints = 5;
  const scores: Record<string, number> = {};
  const firstChoiceCounts: Record<string, number> = {};
  for (const area of PRIORITY_AREAS) {
    scores[area] = 0;
    firstChoiceCounts[area] = 0;
  }

  for (const s of signals) {
    const ranking = s.ranked_priorities as string[];
    for (let i = 0; i < ranking.length; i++) {
      const points = maxPoints - i;
      scores[ranking[i]] = (scores[ranking[i]] || 0) + points;
      if (i === 0) firstChoiceCounts[ranking[i]] = (firstChoiceCounts[ranking[i]] || 0) + 1;
    }
  }

  const priorities = Object.entries(scores)
    .map(([priority, score]) => ({
      priority,
      label: PRIORITY_LABELS[priority] ?? priority,
      score,
      weightedScore: score,
      rank: 0,
      firstChoiceCount: firstChoiceCounts[priority] || 0,
      totalVoters: signals.length,
      trend: null,
    }))
    .sort((a, b) => b.score - a.score)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  return {
    epoch,
    totalVoters: signals.length,
    updatedAt: new Date().toISOString(),
    priorities,
  };
}

// ---------------------------------------------------------------------------
// 2. Sentiment Divergence Index
// ---------------------------------------------------------------------------

/**
 * Compute the divergence between citizen sentiment and DRep votes.
 *
 * For each proposal with both citizen sentiment data and DRep vote data,
 * calculates a divergence score (0 = perfect alignment, 1 = complete divergence).
 *
 * Uses Earth Mover's Distance between the two distributions:
 *   citizen: [support, oppose, unsure] mapped to [yes, no, abstain]
 *   drep:    [yes, no, abstain]
 */
export async function getSentimentDivergence(
  targetEpoch?: number,
): Promise<SentimentDivergenceResult | null> {
  const supabase = createClient();
  const epoch = targetEpoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Try snapshot first
  const { data: snapshot } = await supabase
    .from('community_intelligence_snapshots')
    .select('data, computed_at')
    .eq('snapshot_type', 'divergence')
    .eq('epoch', epoch)
    .single();

  if (snapshot?.data) {
    return snapshot.data as unknown as SentimentDivergenceResult;
  }

  // Compute from raw data
  return computeSentimentDivergence(epoch);
}

export async function computeSentimentDivergence(
  epoch: number,
): Promise<SentimentDivergenceResult | null> {
  const supabase = createClient();

  // Get sentiment aggregations for proposals
  const { data: sentimentAggs } = await supabase
    .from('engagement_signal_aggregations')
    .select('entity_id, data')
    .eq('entity_type', 'proposal')
    .eq('signal_type', 'sentiment')
    .eq('epoch', epoch);

  if (!sentimentAggs || sentimentAggs.length === 0) return null;

  // Get DRep votes for the same epoch
  const { data: drepVotes } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('epoch_no', epoch);

  if (!drepVotes || drepVotes.length === 0) return null;

  // Aggregate DRep votes by proposal
  const drepVotesByProposal = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of drepVotes) {
    const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
    if (!drepVotesByProposal.has(key)) {
      drepVotesByProposal.set(key, { yes: 0, no: 0, abstain: 0 });
    }
    const agg = drepVotesByProposal.get(key)!;
    const vote = (v.vote as string)?.toLowerCase();
    if (vote === 'yes') agg.yes++;
    else if (vote === 'no') agg.no++;
    else agg.abstain++;
  }

  // Get proposal titles
  const proposalKeys = sentimentAggs.map((s) => s.entity_id);
  const txHashes = [...new Set(proposalKeys.map((k) => k.split(':')[0]))];

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title')
    .in('tx_hash', txHashes);

  const titleMap = new Map<string, string | null>();
  if (proposals) {
    for (const p of proposals) {
      titleMap.set(`${p.tx_hash}:${p.proposal_index}`, p.title);
    }
  }

  // Compute divergence per proposal
  const proposalDivergences: ProposalDivergence[] = [];

  for (const sentimentAgg of sentimentAggs) {
    const key = sentimentAgg.entity_id;
    const drepAgg = drepVotesByProposal.get(key);
    if (!drepAgg) continue;

    const sentimentData = sentimentAgg.data as {
      support: number;
      oppose: number;
      unsure: number;
      total: number;
    };
    if (!sentimentData.total || sentimentData.total === 0) continue;

    const drepTotal = drepAgg.yes + drepAgg.no + drepAgg.abstain;
    if (drepTotal === 0) continue;

    // Normalize both distributions
    const citizenDist = [
      sentimentData.support / sentimentData.total,
      sentimentData.oppose / sentimentData.total,
      sentimentData.unsure / sentimentData.total,
    ];
    const drepDist = [drepAgg.yes / drepTotal, drepAgg.no / drepTotal, drepAgg.abstain / drepTotal];

    // Jensen-Shannon divergence (symmetric, bounded 0-1)
    const divergence = jensenShannonDivergence(citizenDist, drepDist);

    const [txHash, indexStr] = key.split(':');

    proposalDivergences.push({
      proposalTxHash: txHash,
      proposalIndex: parseInt(indexStr, 10),
      proposalTitle: titleMap.get(key) ?? null,
      citizenSentiment: {
        support: sentimentData.support,
        oppose: sentimentData.oppose,
        unsure: sentimentData.unsure,
        total: sentimentData.total,
      },
      drepVote: { ...drepAgg, total: drepTotal },
      divergenceScore: Math.round(divergence * 1000) / 1000,
    });
  }

  // Sort by divergence (highest first)
  proposalDivergences.sort((a, b) => b.divergenceScore - a.divergenceScore);

  // Aggregate divergence: weighted average by total signals
  const totalWeight = proposalDivergences.reduce(
    (sum, p) => sum + p.citizenSentiment.total + p.drepVote.total,
    0,
  );
  const aggregateDivergence =
    totalWeight > 0
      ? proposalDivergences.reduce(
          (sum, p) => sum + p.divergenceScore * (p.citizenSentiment.total + p.drepVote.total),
          0,
        ) / totalWeight
      : 0;

  return {
    epoch,
    proposals: proposalDivergences,
    aggregateDivergence: Math.round(aggregateDivergence * 1000) / 1000,
    updatedAt: new Date().toISOString(),
  };
}

/** Jensen-Shannon divergence between two distributions, bounded [0, 1]. */
function jensenShannonDivergence(p: number[], q: number[]): number {
  const m = p.map((pi, i) => (pi + q[i]) / 2);
  const klPM = klDivergence(p, m);
  const klQM = klDivergence(q, m);
  // JSD is bounded [0, ln(2)] for natural log. Normalize to [0, 1].
  return Math.min(1, (klPM + klQM) / (2 * Math.LN2));
}

/** KL divergence D_KL(p || q). Uses smoothing to avoid log(0). */
function klDivergence(p: number[], q: number[]): number {
  const epsilon = 1e-10;
  let sum = 0;
  for (let i = 0; i < p.length; i++) {
    const pi = Math.max(p[i], epsilon);
    const qi = Math.max(q[i], epsilon);
    sum += pi * Math.log(pi / qi);
  }
  return Math.max(0, sum);
}

// ---------------------------------------------------------------------------
// 3. Governance Temperature
// ---------------------------------------------------------------------------

/**
 * Compute a single governance "temperature" score (0-100) that reflects
 * overall governance activity and sentiment polarization.
 *
 * Components (each 0-25):
 *   - Engagement volume: citizen participation (sentiment + priority + assembly)
 *   - Sentiment polarization: how divided opinions are
 *   - Proposal velocity: how many proposals are active
 *   - Participation rate: what % of DReps are voting
 */
export async function getGovernanceTemperature(
  targetEpoch?: number,
): Promise<GovernanceTemperatureResult | null> {
  const supabase = createClient();
  const epoch = targetEpoch ?? blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Try snapshot first
  const { data: snapshot } = await supabase
    .from('community_intelligence_snapshots')
    .select('data, computed_at')
    .eq('snapshot_type', 'temperature')
    .eq('epoch', epoch)
    .single();

  if (snapshot?.data) {
    return snapshot.data as unknown as GovernanceTemperatureResult;
  }

  return computeGovernanceTemperature(epoch);
}

export async function computeGovernanceTemperature(
  epoch: number,
): Promise<GovernanceTemperatureResult | null> {
  const supabase = createClient();

  // 1. Engagement volume (0-25)
  // Count total citizen signals this epoch
  const [sentimentCount, priorityCount, assemblyCount] = await Promise.all([
    supabase.from('citizen_sentiment').select('id', { count: 'exact', head: true }),
    supabase
      .from('citizen_priority_signals')
      .select('id', { count: 'exact', head: true })
      .eq('epoch', epoch),
    supabase.from('citizen_assembly_responses').select('id', { count: 'exact', head: true }),
  ]);

  const totalEngagement =
    (sentimentCount.count ?? 0) + (priorityCount.count ?? 0) + (assemblyCount.count ?? 0);

  // Scale: 0 signals = 0, 500+ signals = 25 (logarithmic)
  const engagementVolume = Math.min(
    25,
    Math.round((Math.log(totalEngagement + 1) / Math.log(501)) * 25),
  );

  // 2. Sentiment polarization (0-25)
  // How evenly split are citizen sentiments? Maximum polarization = 50/50 support/oppose
  const { data: sentimentAggs } = await supabase
    .from('engagement_signal_aggregations')
    .select('data')
    .eq('entity_type', 'proposal')
    .eq('signal_type', 'sentiment')
    .eq('epoch', epoch);

  let sentimentPolarization = 0;
  if (sentimentAggs && sentimentAggs.length > 0) {
    let totalPolarization = 0;
    let validProposals = 0;

    for (const agg of sentimentAggs) {
      const data = agg.data as { support: number; oppose: number; total: number };
      if (!data.total || data.total < 3) continue; // Need minimum signals for meaningful polarization

      const supportRatio = data.support / data.total;
      const opposeRatio = data.oppose / data.total;
      // Polarization = 1 when 50/50, 0 when unanimous
      const polarization = 1 - Math.abs(supportRatio - opposeRatio);
      totalPolarization += polarization;
      validProposals++;
    }

    sentimentPolarization =
      validProposals > 0 ? Math.round((totalPolarization / validProposals) * 25) : 0;
  }

  // 3. Proposal velocity (0-25)
  const { count: activeProposals } = await supabase
    .from('proposals')
    .select('tx_hash', { count: 'exact', head: true })
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null);

  // Scale: 0 proposals = 0, 20+ active proposals = 25
  const proposalVelocity = Math.min(25, Math.round(((activeProposals ?? 0) / 20) * 25));

  // 4. Participation rate (0-25)
  const { data: dreps } = await supabase.from('dreps').select('info').not('info', 'is', null);

  let participationRate = 0;
  if (dreps && dreps.length > 0) {
    const activeDreps = dreps.filter((d) => (d.info as Record<string, unknown> | null)?.isActive);
    const totalDreps = dreps.length;
    participationRate =
      totalDreps > 0 ? Math.min(25, Math.round((activeDreps.length / totalDreps) * 25)) : 0;
  }

  const temperature =
    engagementVolume + sentimentPolarization + proposalVelocity + participationRate;

  const band: GovernanceTemperatureResult['band'] =
    temperature <= 25 ? 'cold' : temperature <= 50 ? 'cool' : temperature <= 75 ? 'warm' : 'hot';

  return {
    epoch,
    temperature,
    components: {
      engagementVolume,
      sentimentPolarization,
      proposalVelocity,
      participationRate,
    },
    band,
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Snapshot storage (called by Inngest background job)
// ---------------------------------------------------------------------------

export async function storeCommunitySnapshot(
  snapshotType: string,
  epoch: number,
  data: Record<string, unknown>,
): Promise<boolean> {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('community_intelligence_snapshots').upsert(
      {
        snapshot_type: snapshotType,
        epoch,
        data,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'snapshot_type,epoch' },
    );

    if (error) {
      logger.error('[CommunityIntelligence] Failed to store snapshot', {
        snapshotType,
        epoch,
        error: error.message,
      });
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[CommunityIntelligence] Unexpected error storing snapshot', { error: err });
    return false;
  }
}
