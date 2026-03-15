/**
 * Delegation simulation engine (WS-2).
 *
 * Answers: "If you had delegated to this DRep N months ago,
 * here's how your ADA would have voted."
 *
 * Separates pure computation from data fetching:
 * - `computeDelegationSimulation` is a pure function (testable without DB)
 * - `fetchDelegationSimulation` orchestrates data fetching then calls the pure fn
 */

import type { AlignmentScores } from '@/lib/drepIdentity';
import type { DRepVoteRow, CachedProposal } from '@/lib/data';
import { getVotesByDRepId, getProposalsByIds } from '@/lib/data';
import type { ProposalOutcome } from '@/lib/proposalOutcomes';
import { getProposalOutcomesBatch } from '@/lib/proposalOutcomes';
import { predictUserStance, type VoteClassification } from './proposalAlignment';
import { createClient } from '@/lib/supabase';

/* ─── Constants ───────────────────────────────────────── */

/** Default lookback in epochs (~6 months at ~5 days/epoch). */
const DEFAULT_LOOKBACK_EPOCHS = 36;

/* ─── Types ───────────────────────────────────────────── */

export interface SimulatedVote {
  proposalId: string;
  proposalTitle: string;
  proposalType: string;
  drepVote: 'Yes' | 'No' | 'Abstain';
  outcome: 'Enacted' | 'Expired' | 'Dropped' | 'Pending';
  deliveryStatus?: 'delivered' | 'partial' | 'not_delivered' | 'in_progress' | null;
  deliveryScore?: number | null;
  alignmentWithUser: 'agree' | 'disagree' | 'neutral' | null;
  epoch: number;
}

export interface DelegationSimulation {
  periodLabel: string;
  totalProposals: number;
  drepVotedOn: number;
  participationRate: number;
  enactedCount: number;
  deliverySuccessRate: number | null;
  deliveryCoverage: string | null;
  alignedVoteCount: number;
  totalClassifiedVotes: number;
  simulatedVotes: SimulatedVote[];
}

/** Input data for pure computation. */
export interface SimulationInput {
  drepVotes: DRepVoteRow[];
  proposals: Map<string, CachedProposal>;
  outcomes: Map<string, ProposalOutcome>;
  classifications?: Map<string, VoteClassification>;
  userAlignment?: AlignmentScores | null;
  currentEpoch?: number;
  lookbackEpochs?: number;
  /** Total proposals in the epoch window (from the proposals table). */
  totalProposalCount?: number | null;
}

/* ─── Helpers ─────────────────────────────────────────── */

/**
 * Determine proposal outcome from proposal metadata and outcome data.
 */
function resolveOutcome(
  proposal: CachedProposal | undefined,
  outcome: ProposalOutcome | undefined,
): 'Enacted' | 'Expired' | 'Dropped' | 'Pending' {
  // If we have delivery data, the proposal was enacted
  if (outcome && outcome.deliveryStatus !== 'unknown') return 'Enacted';

  if (!proposal) return 'Pending';

  // Check proposal-level status indicators via available fields
  // CachedProposal has: txHash, proposalIndex, title, abstract, aiSummary,
  //   proposalType, withdrawalAmount, treasuryTier, relevantPrefs
  // We don't have status fields on CachedProposal, so rely on outcome data
  if (outcome) return 'Enacted';
  return 'Pending';
}

/**
 * Determine alignment between user stance and DRep vote for a single proposal.
 */
function computeVoteAlignment(
  drepVote: 'Yes' | 'No' | 'Abstain',
  userAlignment: AlignmentScores | null | undefined,
  classification: VoteClassification | undefined,
): 'agree' | 'disagree' | 'neutral' | null {
  if (!userAlignment || !classification) return null;
  if (drepVote === 'Abstain') return 'neutral';

  // Find primary dimension (highest classification score)
  const dimEntries: [string, number][] = [
    ['treasuryConservative', classification.dimTreasuryConservative],
    ['treasuryGrowth', classification.dimTreasuryGrowth],
    ['decentralization', classification.dimDecentralization],
    ['security', classification.dimSecurity],
    ['innovation', classification.dimInnovation],
    ['transparency', classification.dimTransparency],
  ];

  let bestDim: string | null = null;
  let bestScore = 0;
  for (const [dim, score] of dimEntries) {
    if (score > bestScore) {
      bestScore = score;
      bestDim = dim;
    }
  }

  if (!bestDim || bestScore < 0.6) return null;

  const userScore = userAlignment[bestDim as keyof AlignmentScores];
  const prediction = predictUserStance(userScore, bestScore);

  if (prediction.stance === 'Neutral') return 'neutral';
  if (prediction.stance === drepVote) return 'agree';
  return 'disagree';
}

/* ─── Pure Computation ────────────────────────────────── */

/**
 * Compute a delegation simulation from pre-fetched data.
 * Pure function -- no database access.
 *
 * @param input - All required data pre-fetched by the caller
 * @returns DelegationSimulation result
 */
export function computeDelegationSimulation(input: SimulationInput): DelegationSimulation {
  const {
    drepVotes,
    proposals,
    outcomes,
    classifications,
    userAlignment,
    currentEpoch,
    lookbackEpochs = DEFAULT_LOOKBACK_EPOCHS,
    totalProposalCount,
  } = input;

  // Determine epoch window
  const latestEpoch =
    currentEpoch ??
    (drepVotes.length > 0
      ? Math.max(...drepVotes.filter((v) => v.epoch_no !== null).map((v) => v.epoch_no!))
      : 0);
  const startEpoch = latestEpoch - lookbackEpochs;

  // Filter votes to the lookback window
  const windowVotes = drepVotes.filter((v) => v.epoch_no !== null && v.epoch_no >= startEpoch);

  // Build period label
  const periodLabel = `Epochs ${startEpoch}\u2013${latestEpoch} (~${Math.round((lookbackEpochs * 5) / 30)} months)`;

  if (windowVotes.length === 0) {
    return {
      periodLabel,
      totalProposals: 0,
      drepVotedOn: 0,
      participationRate: 0,
      enactedCount: 0,
      deliverySuccessRate: null,
      deliveryCoverage: null,
      alignedVoteCount: 0,
      totalClassifiedVotes: 0,
      simulatedVotes: [],
    };
  }

  // Count unique proposals in the window via the DRep's votes
  const uniqueProposals = new Set(
    windowVotes.map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`),
  );
  const drepVotedOn = uniqueProposals.size;

  // Build simulated votes (most recent first -- windowVotes inherits order from getVotesByDRepId)
  const simulatedVotes: SimulatedVote[] = [];
  let enactedCount = 0;
  let deliveredCount = 0;
  let deliveryEvaluatedCount = 0;
  let alignedVoteCount = 0;
  let totalClassifiedVotes = 0;

  for (const vote of windowVotes) {
    const proposalKey = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
    const proposal = proposals.get(proposalKey);
    const outcome = outcomes.get(proposalKey);
    const classification = classifications?.get(proposalKey);

    const resolvedOutcome = resolveOutcome(proposal, outcome);
    if (resolvedOutcome === 'Enacted') enactedCount++;

    // Delivery tracking
    let deliveryStatus: SimulatedVote['deliveryStatus'] = null;
    let deliveryScore: number | null = null;
    if (outcome) {
      deliveryStatus = outcome.deliveryStatus === 'unknown' ? null : outcome.deliveryStatus;
      deliveryScore = outcome.deliveryScore;
      if (deliveryStatus && deliveryStatus !== 'in_progress') {
        deliveryEvaluatedCount++;
        if (deliveryStatus === 'delivered' || deliveryStatus === 'partial') {
          deliveredCount++;
        }
      }
    }

    // Alignment computation
    const alignmentWithUser = computeVoteAlignment(vote.vote, userAlignment, classification);
    if (alignmentWithUser !== null) {
      totalClassifiedVotes++;
      if (alignmentWithUser === 'agree') alignedVoteCount++;
    }

    simulatedVotes.push({
      proposalId: proposalKey,
      proposalTitle: proposal?.title ?? `Proposal ${vote.proposal_tx_hash.slice(0, 8)}...`,
      proposalType: proposal?.proposalType ?? 'Unknown',
      drepVote: vote.vote,
      outcome: resolvedOutcome,
      deliveryStatus,
      deliveryScore,
      alignmentWithUser,
      epoch: vote.epoch_no ?? 0,
    });
  }

  // Aggregate stats
  // totalProposals = actual proposals in the epoch window (from DB), falling back to drepVotedOn
  const totalProposals =
    totalProposalCount != null && totalProposalCount > 0 ? totalProposalCount : drepVotedOn;
  const participationRate = totalProposals > 0 ? drepVotedOn / totalProposals : 0;

  const deliverySuccessRate =
    deliveryEvaluatedCount > 0 ? Math.round((deliveredCount / deliveryEvaluatedCount) * 100) : null;

  const deliveryCoverage =
    enactedCount > 0
      ? `${deliveryEvaluatedCount} of ${enactedCount} enacted proposals have delivery data`
      : null;

  return {
    periodLabel,
    totalProposals,
    drepVotedOn,
    participationRate,
    enactedCount,
    deliverySuccessRate,
    deliveryCoverage,
    alignedVoteCount,
    totalClassifiedVotes,
    simulatedVotes,
  };
}

/* ─── Data-Fetching Orchestrator ──────────────────────── */

/**
 * Fetch data and compute delegation simulation for a DRep.
 *
 * Orchestrator function that handles all DB access, then delegates
 * to the pure `computeDelegationSimulation`.
 *
 * @param drepId - DRep identifier
 * @param userAlignment - Optional user alignment for per-vote alignment
 * @param lookbackEpochs - How many epochs to look back (default: 36 ~ 6 months)
 * @returns DelegationSimulation result
 */
export async function fetchDelegationSimulation(
  drepId: string,
  userAlignment?: AlignmentScores | null,
  lookbackEpochs?: number,
): Promise<DelegationSimulation> {
  const effectiveLookback = lookbackEpochs ?? DEFAULT_LOOKBACK_EPOCHS;

  // Fetch DRep votes (already ordered by block_time DESC)
  const drepVotes = await getVotesByDRepId(drepId);

  if (drepVotes.length === 0) {
    return computeDelegationSimulation({
      drepVotes: [],
      proposals: new Map(),
      outcomes: new Map(),
      lookbackEpochs: effectiveLookback,
    });
  }

  // Determine epoch window for total proposal count
  const latestEpoch = Math.max(
    ...drepVotes.filter((v) => v.epoch_no !== null).map((v) => v.epoch_no!),
    0,
  );
  const cutoffEpoch = latestEpoch - effectiveLookback;

  // Build proposal ID list for batch fetches
  const proposalIds = drepVotes.map((v) => ({
    txHash: v.proposal_tx_hash,
    index: v.proposal_index,
  }));

  const outcomeKeys = drepVotes.map((v) => ({
    txHash: v.proposal_tx_hash,
    proposalIndex: v.proposal_index,
  }));

  // Parallel data fetches — include total proposal count for the epoch window
  const [proposals, outcomes, totalProposalResult] = await Promise.all([
    getProposalsByIds(proposalIds),
    getProposalOutcomesBatch(outcomeKeys),
    createClient()
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .gte('proposed_epoch', cutoffEpoch)
      .then((r) => r.count ?? null),
  ]);

  return computeDelegationSimulation({
    drepVotes,
    proposals,
    outcomes,
    userAlignment,
    lookbackEpochs: effectiveLookback,
    totalProposalCount: totalProposalResult,
  });
}
