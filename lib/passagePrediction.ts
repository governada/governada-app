/**
 * Passage Prediction Model
 *
 * Rules-based, deterministic passage probability for governance proposals.
 * Uses current voting tallies, CIP-1694 thresholds, constitutional compliance,
 * citizen sentiment, and proposer track record to estimate passage probability.
 *
 * No AI — pure computation from existing data.
 */

import { getVotingBodies } from '@/lib/governance/votingBodies';
import { getGovernanceThresholdForProposal } from '@/lib/governanceThresholds';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PassagePredictionThresholds {
  drep: number | null;
  spo: number | null;
  cc: number | null;
}

export interface PassagePredictionInput {
  proposalType: string;
  paramChanges?: Record<string, unknown> | null;
  thresholds?: PassagePredictionThresholds | null;
  /** DRep vote tallies */
  drepVotes: { yes: number; no: number; abstain: number };
  /** SPO vote tallies */
  spoVotes: { yes: number; no: number; abstain: number };
  /** CC vote tallies */
  ccVotes: { yes: number; no: number; abstain: number };
  /** Constitutional compliance score from intelligence cache */
  constitutionalScore?: 'pass' | 'warning' | 'fail' | null;
  /** Citizen sentiment (support/oppose) */
  citizenSentiment?: { support: number; oppose: number; total: number } | null;
  /** Proposer historical pass rate (0-1) */
  proposerPassRate?: number | null;
  /** Treasury withdrawal amount in ADA (if applicable) */
  withdrawalAmount?: number | null;
}

export interface PassageFactor {
  name: string;
  weight: number;
  value: number;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface PassagePredictionResult {
  probability: number; // 1-99
  confidence: 'low' | 'medium' | 'high';
  factors: PassageFactor[];
  computedAt: string;
}

// ---------------------------------------------------------------------------
// CIP-1694 Thresholds
// ---------------------------------------------------------------------------

/**
 * CIP-1694 governance action thresholds.
 * Each action type requires different approval ratios from different bodies.
 * null = body does not vote on this action type.
 */
const DEFAULT_DREP_THRESHOLDS: Record<string, number | null> = {
  NoConfidence: 0.67,
  NewCommittee: 0.67,
  NewConstitutionalCommittee: 0.67,
  NewConstitution: 0.75,
  UpdateConstitution: 0.75,
  HardForkInitiation: 0.6,
  ParameterChange: 0.67,
  TreasuryWithdrawals: 0.67,
  InfoAction: 1.0,
};

const DEFAULT_THRESHOLDS: PassagePredictionThresholds = { drep: 0.67, spo: 0.51, cc: 2 / 3 };
const STANDARD_SPO_APPROVAL_THRESHOLD = 0.51;
const INFO_ACTION_APPROVAL_THRESHOLD = 1;
const CC_APPROVAL_THRESHOLD = 2 / 3;

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  drepVoteRatio: 0.35,
  spoVoteRatio: 0.15,
  ccVoteRatio: 0.15,
  thresholdTrajectory: 0.1,
  constitutionalCompliance: 0.1,
  citizenSentiment: 0.05,
  proposerTrackRecord: 0.05,
  treasuryTier: 0.05,
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

export function computePassagePrediction(input: PassagePredictionInput): PassagePredictionResult {
  const thresholds =
    input.thresholds ??
    getFallbackPassagePredictionThresholds(input.proposalType, input.paramChanges);
  const factors: PassageFactor[] = [];

  // 1. DRep vote ratio
  const drepTotal = input.drepVotes.yes + input.drepVotes.no;
  const drepRatio = drepTotal > 0 ? input.drepVotes.yes / drepTotal : 0.5;
  const drepValue = thresholds.drep != null ? drepRatio / thresholds.drep : 0.5;
  factors.push({
    name: 'DRep approval',
    weight: WEIGHTS.drepVoteRatio,
    value: clamp01(drepValue),
    direction: drepValue >= 1 ? 'positive' : drepValue < 0.7 ? 'negative' : 'neutral',
  });

  // 2. SPO vote ratio
  const spoTotal = input.spoVotes.yes + input.spoVotes.no;
  const spoRatio = spoTotal > 0 ? input.spoVotes.yes / spoTotal : 0.5;
  const spoValue = thresholds.spo != null ? spoRatio / thresholds.spo : 0.5; // neutral if SPO doesn't vote
  factors.push({
    name: 'SPO approval',
    weight: WEIGHTS.spoVoteRatio,
    value: clamp01(spoValue),
    direction:
      thresholds.spo == null
        ? 'neutral'
        : spoValue >= 1
          ? 'positive'
          : spoValue < 0.7
            ? 'negative'
            : 'neutral',
  });

  // 3. CC vote ratio
  const ccTotal = input.ccVotes.yes + input.ccVotes.no;
  const ccRatio = ccTotal > 0 ? input.ccVotes.yes / ccTotal : 0.5;
  const ccValue = thresholds.cc != null ? ccRatio / thresholds.cc : 0.5;
  factors.push({
    name: 'CC approval',
    weight: WEIGHTS.ccVoteRatio,
    value: clamp01(ccValue),
    direction:
      thresholds.cc == null
        ? 'neutral'
        : ccValue >= 1
          ? 'positive'
          : ccValue < 0.7
            ? 'negative'
            : 'neutral',
  });

  // 4. Threshold trajectory (are current ratios on track?)
  let trajectoryValue = 0.5;
  let bodiesMeeting = 0;
  let bodiesRequired = 0;
  if (thresholds.drep != null) {
    bodiesRequired++;
    if (drepRatio >= thresholds.drep) bodiesMeeting++;
  }
  if (thresholds.spo != null) {
    bodiesRequired++;
    if (spoRatio >= thresholds.spo) bodiesMeeting++;
  }
  if (thresholds.cc != null) {
    bodiesRequired++;
    if (ccRatio >= thresholds.cc) bodiesMeeting++;
  }
  trajectoryValue = bodiesRequired > 0 ? bodiesMeeting / bodiesRequired : 0.5;
  factors.push({
    name: 'Threshold trajectory',
    weight: WEIGHTS.thresholdTrajectory,
    value: trajectoryValue,
    direction: trajectoryValue >= 1 ? 'positive' : trajectoryValue < 0.5 ? 'negative' : 'neutral',
  });

  // 5. Constitutional compliance
  let complianceValue = 0.5;
  if (input.constitutionalScore === 'pass') complianceValue = 1.0;
  else if (input.constitutionalScore === 'warning') complianceValue = 0.4;
  else if (input.constitutionalScore === 'fail') complianceValue = 0.1;
  factors.push({
    name: 'Constitutional compliance',
    weight: WEIGHTS.constitutionalCompliance,
    value: complianceValue,
    direction: complianceValue >= 0.8 ? 'positive' : complianceValue < 0.4 ? 'negative' : 'neutral',
  });

  // 6. Citizen sentiment
  let sentimentValue = 0.5;
  if (input.citizenSentiment && input.citizenSentiment.total > 0) {
    const denom = input.citizenSentiment.support + input.citizenSentiment.oppose;
    sentimentValue = denom > 0 ? input.citizenSentiment.support / denom : 0.5;
  }
  factors.push({
    name: 'Citizen sentiment',
    weight: WEIGHTS.citizenSentiment,
    value: sentimentValue,
    direction: sentimentValue >= 0.7 ? 'positive' : sentimentValue < 0.4 ? 'negative' : 'neutral',
  });

  // 7. Proposer track record
  const proposerValue = input.proposerPassRate ?? 0.5;
  factors.push({
    name: 'Proposer track record',
    weight: WEIGHTS.proposerTrackRecord,
    value: clamp01(proposerValue),
    direction: proposerValue >= 0.7 ? 'positive' : proposerValue < 0.3 ? 'negative' : 'neutral',
  });

  // 8. Treasury tier (higher amounts face more scrutiny)
  let treasuryValue = 0.5; // neutral for non-treasury proposals
  if (input.withdrawalAmount != null && input.withdrawalAmount > 0) {
    // Higher amounts = lower base probability
    if (input.withdrawalAmount < 100_000) treasuryValue = 0.7;
    else if (input.withdrawalAmount < 1_000_000) treasuryValue = 0.5;
    else if (input.withdrawalAmount < 10_000_000) treasuryValue = 0.3;
    else treasuryValue = 0.15;
  }
  factors.push({
    name: 'Treasury scrutiny',
    weight: WEIGHTS.treasuryTier,
    value: treasuryValue,
    direction: treasuryValue >= 0.6 ? 'positive' : treasuryValue < 0.35 ? 'negative' : 'neutral',
  });

  // Compute weighted sum
  const rawProbability = factors.reduce((sum, f) => sum + f.value * f.weight, 0);

  // Map to 1-99 range
  const probability = Math.max(1, Math.min(99, Math.round(rawProbability * 100)));

  // Confidence based on total vote count
  const totalVotes =
    input.drepVotes.yes +
    input.drepVotes.no +
    input.drepVotes.abstain +
    input.spoVotes.yes +
    input.spoVotes.no +
    input.spoVotes.abstain +
    input.ccVotes.yes +
    input.ccVotes.no +
    input.ccVotes.abstain;

  const confidence: 'low' | 'medium' | 'high' =
    totalVotes < 10 ? 'low' : totalVotes < 50 ? 'medium' : 'high';

  return {
    probability,
    confidence,
    factors,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ---------------------------------------------------------------------------
// Shared data-fetching helpers (used by both Inngest functions)
// ---------------------------------------------------------------------------

/** Extract { yes, no, abstain } from a vote summary row for a given body prefix. */
function extractTally(
  row: Record<string, unknown> | null | undefined,
  prefix: string,
): { yes: number; no: number; abstain: number } {
  return {
    yes: (row?.[`${prefix}_yes`] as number) ?? 0,
    no: (row?.[`${prefix}_no`] as number) ?? 0,
    abstain: (row?.[`${prefix}_abstain`] as number) ?? 0,
  };
}

/** Parse a constitutional score string into a typed value or null. */
function parseConstScore(score: string | null | undefined): 'pass' | 'warning' | 'fail' | null {
  if (score === 'pass' || score === 'warning' || score === 'fail') return score;
  return null;
}

/**
 * Build a PassagePredictionInput from pre-fetched lookup maps.
 * Eliminates duplication between precompute-proposal-intelligence and
 * update-passage-predictions Inngest functions.
 */
export function buildPredictionInput(
  proposal: {
    tx_hash: string;
    proposal_index: number;
    proposal_type: string;
    withdrawal_amount: number | null;
    param_changes?: Record<string, unknown> | null;
  },
  voteMap: Map<string, Record<string, unknown>>,
  constMap: Map<string, string>,
  sentimentMap: Map<string, Record<string, unknown>>,
): { input: PassagePredictionInput; voteHash: string } {
  const key = `${proposal.tx_hash}-${proposal.proposal_index}`;
  const voteSummary = voteMap.get(key) ?? null;

  const input: PassagePredictionInput = {
    proposalType: proposal.proposal_type,
    paramChanges: proposal.param_changes ?? null,
    drepVotes: extractTally(voteSummary, 'drep'),
    spoVotes: extractTally(voteSummary, 'spo'),
    ccVotes: extractTally(voteSummary, 'cc'),
    constitutionalScore: parseConstScore(constMap.get(key)),
    citizenSentiment: sentimentMap.has(key)
      ? {
          support: (sentimentMap.get(key)!.support as number) ?? 0,
          oppose: (sentimentMap.get(key)!.oppose as number) ?? 0,
          total: (sentimentMap.get(key)!.total as number) ?? 0,
        }
      : null,
    withdrawalAmount: proposal.withdrawal_amount,
  };

  const totalVoteCount =
    ((voteSummary?.drep_yes as number) ?? 0) +
    ((voteSummary?.drep_no as number) ?? 0) +
    ((voteSummary?.spo_yes as number) ?? 0) +
    ((voteSummary?.cc_yes as number) ?? 0);

  return { input, voteHash: `votes-${totalVoteCount}` };
}

function getFallbackPassagePredictionThresholds(
  proposalType: string,
  paramChanges?: Record<string, unknown> | null,
): PassagePredictionThresholds {
  const eligibleBodies = new Set(getVotingBodies(proposalType, paramChanges));

  return {
    drep: eligibleBodies.has('drep')
      ? (DEFAULT_DREP_THRESHOLDS[proposalType] ?? DEFAULT_THRESHOLDS.drep)
      : null,
    spo: eligibleBodies.has('spo')
      ? proposalType === 'InfoAction'
        ? INFO_ACTION_APPROVAL_THRESHOLD
        : STANDARD_SPO_APPROVAL_THRESHOLD
      : null,
    cc: eligibleBodies.has('cc') ? CC_APPROVAL_THRESHOLD : null,
  };
}

export async function resolvePassagePredictionThresholds(input: {
  proposalType: string;
  paramChanges?: Record<string, unknown> | null;
}): Promise<PassagePredictionThresholds> {
  const eligibleBodies = new Set(getVotingBodies(input.proposalType, input.paramChanges));
  const drepThreshold =
    eligibleBodies.has('drep') && input.proposalType !== 'InfoAction'
      ? (
          await getGovernanceThresholdForProposal({
            proposalType: input.proposalType,
            paramChanges: input.paramChanges ?? null,
          })
        ).threshold
      : eligibleBodies.has('drep')
        ? INFO_ACTION_APPROVAL_THRESHOLD
        : null;

  return {
    drep: drepThreshold,
    spo: eligibleBodies.has('spo')
      ? input.proposalType === 'InfoAction'
        ? INFO_ACTION_APPROVAL_THRESHOLD
        : STANDARD_SPO_APPROVAL_THRESHOLD
      : null,
    cc: eligibleBodies.has('cc') ? CC_APPROVAL_THRESHOLD : null,
  };
}

/**
 * Batch-fetch all supporting data for passage predictions.
 * Returns lookup maps keyed by "txHash-proposalIndex".
 */
export async function fetchPredictionData(
  supabase: { from: (table: string) => unknown },
  proposals: Array<{ tx_hash: string; proposal_index: number }>,
): Promise<{
  voteMap: Map<string, Record<string, unknown>>;
  constMap: Map<string, string>;
  sentimentMap: Map<string, Record<string, unknown>>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const txHashes = proposals.map((p) => p.tx_hash);
  const entityIds = proposals.map((p) => `${p.tx_hash}-${p.proposal_index}`);

  // Batch-fetch vote summaries
  const { data: allVotes } = await sb
    .from('proposal_voting_summary')
    .select('*')
    .in('proposal_tx_hash', txHashes);
  const voteMap = new Map<string, Record<string, unknown>>(
    (allVotes ?? []).map((v: Record<string, unknown>) => [
      `${v.proposal_tx_hash}-${v.proposal_index}`,
      v,
    ]),
  );

  // Batch-fetch constitutional scores from cache
  const { data: allConst } = await sb
    .from('proposal_intelligence_cache')
    .select('proposal_tx_hash, proposal_index, content')
    .in('proposal_tx_hash', txHashes)
    .eq('section_type', 'constitutional');
  const constMap = new Map<string, string>(
    (allConst ?? []).map((c: Record<string, unknown>) => [
      `${c.proposal_tx_hash}-${c.proposal_index}`,
      ((c.content as Record<string, unknown>)?.score as string) ?? '',
    ]),
  );

  // Batch-fetch citizen sentiment
  const { data: allSentiment } = await sb
    .from('engagement_signal_aggregations')
    .select('entity_id, data')
    .in('entity_id', entityIds)
    .eq('entity_type', 'proposal')
    .eq('signal_type', 'sentiment');
  const sentimentMap = new Map<string, Record<string, unknown>>(
    (allSentiment ?? []).map((s: Record<string, unknown>) => [
      s.entity_id as string,
      s.data as Record<string, unknown>,
    ]),
  );

  return { voteMap, constMap, sentimentMap };
}
