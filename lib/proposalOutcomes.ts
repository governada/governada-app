/**
 * Proposal Outcome Tracking — WP-12
 *
 * Tracks delivery status for enacted proposals, connecting
 * governance decisions to real-world impact. Aggregates
 * accountability poll data into delivery scores.
 */

import { createClient, getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryStatus = 'in_progress' | 'delivered' | 'partial' | 'not_delivered' | 'unknown';

export interface ProposalOutcome {
  proposalTxHash: string;
  proposalIndex: number;
  deliveryStatus: DeliveryStatus;
  deliveryScore: number | null;
  totalPollResponses: number;
  deliveredCount: number;
  partialCount: number;
  notDeliveredCount: number;
  tooEarlyCount: number;
  wouldApproveAgainPct: number | null;
  milestonesTotal: number | null;
  milestonesCompleted: number | null;
  enactedEpoch: number | null;
  lastEvaluatedEpoch: number | null;
  epochsSinceEnactment: number | null;
}

export interface DRepOutcomeSummary {
  totalVotedProposals: number;
  enactedProposals: number;
  deliveredCount: number;
  partialCount: number;
  notDeliveredCount: number;
  inProgressCount: number;
  avgDeliveryScore: number | null;
  /** % of enacted proposals the DRep voted Yes on that delivered */
  approvalSuccessRate: number | null;
}

// ---------------------------------------------------------------------------
// Read Functions (public client)
// ---------------------------------------------------------------------------

/**
 * Get outcome data for a single proposal.
 */
export async function getProposalOutcome(
  txHash: string,
  proposalIndex: number,
): Promise<ProposalOutcome | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('proposal_outcomes')
      .select('*')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .single();

    if (error || !data) return null;
    return mapRow(data);
  } catch (err) {
    logger.error('[ProposalOutcomes] getProposalOutcome error', { error: err });
    return null;
  }
}

/**
 * Get outcomes for multiple proposals (batch).
 */
export async function getProposalOutcomesBatch(
  keys: { txHash: string; proposalIndex: number }[],
): Promise<Map<string, ProposalOutcome>> {
  if (keys.length === 0) return new Map();

  try {
    const supabase = createClient();
    const txHashes = [...new Set(keys.map((k) => k.txHash))];

    const { data, error } = await supabase
      .from('proposal_outcomes')
      .select('*')
      .in('proposal_tx_hash', txHashes);

    if (error || !data) return new Map();

    const map = new Map<string, ProposalOutcome>();
    for (const row of data) {
      map.set(`${row.proposal_tx_hash}-${row.proposal_index}`, mapRow(row));
    }
    return map;
  } catch (err) {
    logger.error('[ProposalOutcomes] getProposalOutcomesBatch error', { error: err });
    return new Map();
  }
}

/**
 * Get outcome summary for a DRep's voting record.
 * Shows how many proposals they voted on delivered vs failed.
 */
export async function getDRepOutcomeSummary(drepId: string): Promise<DRepOutcomeSummary> {
  const empty: DRepOutcomeSummary = {
    totalVotedProposals: 0,
    enactedProposals: 0,
    deliveredCount: 0,
    partialCount: 0,
    notDeliveredCount: 0,
    inProgressCount: 0,
    avgDeliveryScore: null,
    approvalSuccessRate: null,
  };

  try {
    const supabase = createClient();

    // Get all proposals this DRep voted on that have outcomes
    const { data: votes, error: votesErr } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('drep_id', drepId);

    if (votesErr || !votes || votes.length === 0) return empty;

    const txHashes = [...new Set(votes.map((v) => v.proposal_tx_hash))];
    const { data: outcomes, error: outErr } = await supabase
      .from('proposal_outcomes')
      .select('*')
      .in('proposal_tx_hash', txHashes);

    if (outErr || !outcomes || outcomes.length === 0) {
      return { ...empty, totalVotedProposals: votes.length };
    }

    // Build a map of outcomes keyed by proposal
    const outcomeMap = new Map<string, (typeof outcomes)[0]>();
    for (const o of outcomes) {
      outcomeMap.set(`${o.proposal_tx_hash}-${o.proposal_index}`, o);
    }

    // Build vote map for "Yes" tracking
    const voteMap = new Map<string, string>();
    for (const v of votes) {
      voteMap.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v.vote);
    }

    let delivered = 0;
    let partial = 0;
    let notDelivered = 0;
    let inProgress = 0;
    let totalScore = 0;
    let scoredCount = 0;
    let yesOnDelivered = 0;
    let yesOnEnacted = 0;

    for (const [key, outcome] of outcomeMap) {
      const vote = voteMap.get(key);
      if (!vote) continue;

      switch (outcome.delivery_status) {
        case 'delivered':
          delivered++;
          break;
        case 'partial':
          partial++;
          break;
        case 'not_delivered':
          notDelivered++;
          break;
        case 'in_progress':
          inProgress++;
          break;
      }

      if (outcome.delivery_score != null) {
        totalScore += outcome.delivery_score;
        scoredCount++;
      }

      if (vote === 'Yes') {
        yesOnEnacted++;
        if (outcome.delivery_status === 'delivered' || outcome.delivery_status === 'partial') {
          yesOnDelivered++;
        }
      }
    }

    return {
      totalVotedProposals: votes.length,
      enactedProposals: outcomeMap.size,
      deliveredCount: delivered,
      partialCount: partial,
      notDeliveredCount: notDelivered,
      inProgressCount: inProgress,
      avgDeliveryScore: scoredCount > 0 ? Math.round(totalScore / scoredCount) : null,
      approvalSuccessRate:
        yesOnEnacted > 0 ? Math.round((yesOnDelivered / yesOnEnacted) * 100) : null,
    };
  } catch (err) {
    logger.error('[ProposalOutcomes] getDRepOutcomeSummary error', { error: err });
    return empty;
  }
}

// ---------------------------------------------------------------------------
// Computation (admin client — used by Inngest)
// ---------------------------------------------------------------------------

/**
 * Compute and upsert outcomes for all enacted treasury proposals.
 * Called by the track-proposal-outcomes Inngest function.
 */
export async function computeAllProposalOutcomes(): Promise<{
  evaluated: number;
  updated: number;
}> {
  const supabase = getSupabaseAdmin();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Get all enacted treasury proposals
  const { data: enacted, error } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, enacted_epoch, treasury_tier')
    .eq('proposal_type', 'TreasuryWithdrawals')
    .not('enacted_epoch', 'is', null);

  if (error || !enacted) {
    logger.error('[ProposalOutcomes] Failed to fetch enacted proposals', { error });
    return { evaluated: 0, updated: 0 };
  }

  let updated = 0;

  for (const proposal of enacted) {
    const outcome = await computeOutcomeForProposal(
      supabase,
      proposal.tx_hash,
      proposal.proposal_index,
      proposal.enacted_epoch!,
      currentEpoch,
    );

    if (outcome) {
      const { error: upsertErr } = await supabase.from('proposal_outcomes').upsert(
        {
          proposal_tx_hash: proposal.tx_hash,
          proposal_index: proposal.proposal_index,
          delivery_status: outcome.deliveryStatus,
          delivery_score: outcome.deliveryScore,
          total_poll_responses: outcome.totalPollResponses,
          delivered_count: outcome.deliveredCount,
          partial_count: outcome.partialCount,
          not_delivered_count: outcome.notDeliveredCount,
          too_early_count: outcome.tooEarlyCount,
          would_approve_again_pct: outcome.wouldApproveAgainPct,
          enacted_epoch: proposal.enacted_epoch,
          last_evaluated_epoch: currentEpoch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'proposal_tx_hash,proposal_index' },
      );

      if (!upsertErr) updated++;
    }
  }

  return { evaluated: enacted.length, updated };
}

async function computeOutcomeForProposal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  txHash: string,
  proposalIndex: number,
  enactedEpoch: number,
  currentEpoch: number,
): Promise<{
  deliveryStatus: DeliveryStatus;
  deliveryScore: number | null;
  totalPollResponses: number;
  deliveredCount: number;
  partialCount: number;
  notDeliveredCount: number;
  tooEarlyCount: number;
  wouldApproveAgainPct: number | null;
} | null> {
  // Get all accountability poll responses for this proposal
  const { data: responses } = await supabase
    .from('treasury_accountability_responses')
    .select('delivered_rating, would_approve_again')
    .eq('proposal_tx_hash', txHash)
    .eq('proposal_index', proposalIndex);

  const total = responses?.length ?? 0;
  let deliveredCount = 0;
  let partialCount = 0;
  let notDeliveredCount = 0;
  let tooEarlyCount = 0;
  let wouldApproveYes = 0;

  if (responses) {
    for (const r of responses) {
      switch (r.delivered_rating) {
        case 'delivered':
          deliveredCount++;
          break;
        case 'partial':
          partialCount++;
          break;
        case 'not_delivered':
          notDeliveredCount++;
          break;
        case 'too_early':
          tooEarlyCount++;
          break;
      }
      if (r.would_approve_again === 'yes') wouldApproveYes++;
    }
  }

  const wouldApproveAgainPct =
    total > 0 ? Math.round((wouldApproveYes / total) * 10000) / 100 : null;

  // Determine delivery status from poll data
  const deliveryStatus = deriveDeliveryStatus(
    total,
    deliveredCount,
    partialCount,
    notDeliveredCount,
    tooEarlyCount,
    enactedEpoch,
    currentEpoch,
  );

  // Compute delivery score (0-100)
  const deliveryScore = computeDeliveryScore(
    total,
    deliveredCount,
    partialCount,
    notDeliveredCount,
    wouldApproveAgainPct,
  );

  return {
    deliveryStatus,
    deliveryScore,
    totalPollResponses: total,
    deliveredCount,
    partialCount,
    notDeliveredCount,
    tooEarlyCount,
    wouldApproveAgainPct,
  };
}

/**
 * Derive delivery status from accountability poll responses.
 * Uses majority vote with minimum response threshold.
 */
function deriveDeliveryStatus(
  total: number,
  delivered: number,
  partial: number,
  notDelivered: number,
  tooEarly: number,
  enactedEpoch: number,
  currentEpoch: number,
): DeliveryStatus {
  // If no polls have happened yet, check if too early for accountability
  if (total === 0) {
    // Less than 18 epochs (~3 months) since enactment — too early
    if (currentEpoch - enactedEpoch < 18) return 'in_progress';
    // Longer time, but still no responses — unknown
    return 'unknown';
  }

  // If majority says "too early", still in progress
  if (tooEarly > total / 2) return 'in_progress';

  // Among substantive responses (excluding "too early")
  const substantive = delivered + partial + notDelivered;
  if (substantive === 0) return 'in_progress';

  // Majority determines status
  if (delivered >= substantive * 0.5) return 'delivered';
  if (notDelivered >= substantive * 0.5) return 'not_delivered';
  return 'partial';
}

/**
 * Compute a 0-100 delivery score from poll data.
 * Weights: delivered=100, partial=50, not_delivered=0
 * Adjusted by "would approve again" sentiment.
 */
function computeDeliveryScore(
  total: number,
  delivered: number,
  partial: number,
  notDelivered: number,
  wouldApproveAgainPct: number | null,
): number | null {
  const substantive = delivered + partial + notDelivered;
  if (substantive === 0) return null;

  // Base score from delivery ratings (weighted average)
  const baseScore = (delivered * 100 + partial * 50 + notDelivered * 0) / substantive;

  // Adjust by "would approve again" sentiment (±10% influence)
  if (wouldApproveAgainPct != null) {
    const sentimentAdjust = ((wouldApproveAgainPct - 50) / 50) * 10;
    return Math.round(Math.max(0, Math.min(100, baseScore + sentimentAdjust)));
  }

  return Math.round(baseScore);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): ProposalOutcome {
  return {
    proposalTxHash: row.proposal_tx_hash,
    proposalIndex: row.proposal_index,
    deliveryStatus: row.delivery_status as DeliveryStatus,
    deliveryScore: row.delivery_score,
    totalPollResponses: row.total_poll_responses,
    deliveredCount: row.delivered_count,
    partialCount: row.partial_count,
    notDeliveredCount: row.not_delivered_count,
    tooEarlyCount: row.too_early_count,
    wouldApproveAgainPct: row.would_approve_again_pct,
    milestonesTotal: row.milestones_total,
    milestonesCompleted: row.milestones_completed,
    enactedEpoch: row.enacted_epoch,
    lastEvaluatedEpoch: row.last_evaluated_epoch,
    epochsSinceEnactment: row.epochs_since_enactment,
  };
}
