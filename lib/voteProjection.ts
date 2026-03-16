/**
 * Vote Progress & Projection
 *
 * Computes projected outcome for governance proposals using:
 * 1. Historical base rate — "X of Y similar proposals at this stage passed"
 * 2. Recency-weighted trajectory — recent voting pace extrapolated to remaining epochs
 * 3. Current threshold proximity — how close yes power is to required threshold
 */

import { createClient } from '@/lib/supabase';
import type { VotePowerByEpoch } from '@/lib/data';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProjectedOutcome =
  | 'passing'
  | 'likely_pass'
  | 'leaning_pass'
  | 'too_close'
  | 'leaning_fail'
  | 'unlikely_pass'
  | 'no_threshold';

export interface VoteProjection {
  // Current state
  currentYesPct: number;
  thresholdPct: number | null;
  powerGapAda: number | null;
  isPassing: boolean;

  // Participation context
  participationPct: number;
  yesOfVotersPct: number | null;

  // Trajectory
  projectedFinalYesPct: number | null;
  epochsRemaining: number | null;
  votingPeriodPct: number;

  // Historical base rate
  historicalPassRate: number | null;
  historicalSampleSize: number;
  historicalEvidence: string | null;

  // Combined projection
  projectedOutcome: ProjectedOutcome;
  confidence: 'high' | 'medium' | 'low';
  confidenceReason: string;
  verdictLabel: string;
  verdictDetail: string;
}

// ---------------------------------------------------------------------------
// Historical base rate
// ---------------------------------------------------------------------------

interface CompletedProposal {
  proposalType: string;
  passed: boolean;
}

export async function getHistoricalBaseRate(
  proposalType: string,
): Promise<{ passRate: number | null; sampleSize: number; evidence: string | null }> {
  try {
    const supabase = createClient();

    // Query completed proposals of the same type
    const { data: proposals } = await supabase
      .from('proposals')
      .select('proposal_type, enacted_epoch, ratified_epoch, dropped_epoch, expired_epoch')
      .eq('proposal_type', proposalType)
      .or(
        'enacted_epoch.not.is.null,ratified_epoch.not.is.null,dropped_epoch.not.is.null,expired_epoch.not.is.null',
      );

    if (!proposals || proposals.length === 0) {
      return { passRate: null, sampleSize: 0, evidence: null };
    }

    const completed: CompletedProposal[] = proposals.map((p) => ({
      proposalType: p.proposal_type,
      passed: p.enacted_epoch != null || p.ratified_epoch != null,
    }));

    const passed = completed.filter((p) => p.passed).length;
    const total = completed.length;
    const passRate = total > 0 ? passed / total : null;

    const typeLabel = formatProposalType(proposalType);
    const evidence =
      total >= 3
        ? `${passed} of ${total} ${typeLabel} proposals have passed historically.`
        : total > 0
          ? `Only ${total} ${typeLabel} proposal${total !== 1 ? 's have' : ' has'} completed voting — limited historical data.`
          : null;

    return { passRate, sampleSize: total, evidence };
  } catch {
    return { passRate: null, sampleSize: 0, evidence: null };
  }
}

function formatProposalType(type: string): string {
  const labels: Record<string, string> = {
    TreasuryWithdrawals: 'Treasury Withdrawal',
    ParameterChange: 'Parameter Change',
    HardForkInitiation: 'Hard Fork',
    NoConfidence: 'No Confidence',
    NewConstitutionalCommittee: 'Committee Update',
    NewCommittee: 'Committee Update',
    NewConstitution: 'Constitution Update',
    UpdateConstitution: 'Constitution Update',
    InfoAction: 'Info Action',
  };
  return labels[type] || type;
}

// ---------------------------------------------------------------------------
// Trajectory projection (recency-weighted)
// ---------------------------------------------------------------------------

export function computeTrajectory(
  powerByEpoch: VotePowerByEpoch[],
  totalActivePower: number,
  epochsRemaining: number | null,
): number | null {
  if (
    !epochsRemaining ||
    epochsRemaining <= 0 ||
    powerByEpoch.length < 2 ||
    totalActivePower <= 0
  ) {
    return null;
  }

  // Sort by epoch ascending
  const sorted = [...powerByEpoch].sort((a, b) => a.epoch - b.epoch);

  // Compute cumulative yes power at each epoch
  let cumYes = 0;
  const snapshots: Array<{ epoch: number; yesPct: number }> = [];
  for (const ep of sorted) {
    cumYes += ep.yesPower;
    snapshots.push({ epoch: ep.epoch, yesPct: (cumYes / totalActivePower) * 100 });
  }

  if (snapshots.length < 2) return null;

  // Compute epoch-over-epoch deltas with recency weighting
  // More recent epochs get higher weight (exponential decay, factor 0.6)
  const deltas: Array<{ delta: number; weight: number }> = [];
  for (let i = 1; i < snapshots.length; i++) {
    const epochGap = snapshots[i].epoch - snapshots[i - 1].epoch;
    if (epochGap <= 0) continue;
    const deltaPerEpoch = (snapshots[i].yesPct - snapshots[i - 1].yesPct) / epochGap;
    // Weight: most recent = 1.0, exponentially decaying
    const recency = snapshots.length - 1 - i;
    const weight = Math.pow(0.6, recency);
    deltas.push({ delta: deltaPerEpoch, weight });
  }

  if (deltas.length === 0) return null;

  // Weighted average pace (% per epoch)
  const totalWeight = deltas.reduce((s, d) => s + d.weight, 0);
  const weightedPace = deltas.reduce((s, d) => s + d.delta * d.weight, 0) / totalWeight;

  // Current yes %
  const currentYesPct = snapshots[snapshots.length - 1].yesPct;

  // Project forward — floor at current (votes can't be un-cast)
  const projected = currentYesPct + weightedPace * epochsRemaining;

  return Math.max(currentYesPct, Math.min(100, projected));
}

// ---------------------------------------------------------------------------
// Combined projection
// ---------------------------------------------------------------------------

export interface VoteProjectionInput {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  totalActivePower: number;
  threshold: number | null;
  proposalType: string;
  proposedEpoch: number | null;
  expirationEpoch: number | null;
  currentEpoch: number;
  powerByEpoch: VotePowerByEpoch[];
  historicalPassRate: number | null;
  historicalSampleSize: number;
  historicalEvidence: string | null;
}

export function computeVoteProjection(input: VoteProjectionInput): VoteProjection {
  const {
    yesPower,
    totalActivePower,
    threshold,
    proposalType,
    proposedEpoch,
    expirationEpoch,
    currentEpoch,
    powerByEpoch,
    historicalPassRate,
    historicalSampleSize,
    historicalEvidence,
  } = input;

  const { noPower, abstainPower } = input;

  // Current state
  const currentYesPct = totalActivePower > 0 ? (yesPower / totalActivePower) * 100 : 0;
  const thresholdPct = threshold != null ? threshold * 100 : null;
  const isPassing = thresholdPct != null && currentYesPct >= thresholdPct;

  // Participation context — what % of active stake has voted, and among voters what % is Yes
  const votedPower = yesPower + noPower + abstainPower;
  const participationPct = totalActivePower > 0 ? (votedPower / totalActivePower) * 100 : 0;
  const yesOfVotersPct = votedPower > 0 ? (yesPower / votedPower) * 100 : null;

  // Power gap in ADA
  let powerGapAda: number | null = null;
  if (thresholdPct != null && totalActivePower > 0 && !isPassing) {
    const gapLovelace = totalActivePower * threshold! - yesPower;
    powerGapAda = Math.max(0, gapLovelace / 1_000_000);
  }

  // Progress ratio: how far toward threshold (0 = no votes, 1 = at threshold, >1 = above)
  const progressRatio = thresholdPct != null && thresholdPct > 0 ? currentYesPct / thresholdPct : 0;

  // Timing
  const epochsRemaining =
    expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null;
  const totalEpochs =
    proposedEpoch != null && expirationEpoch != null ? expirationEpoch - proposedEpoch : null;
  const elapsedEpochs = proposedEpoch != null ? Math.max(0, currentEpoch - proposedEpoch) : null;
  const votingPeriodPct =
    totalEpochs != null && totalEpochs > 0 && elapsedEpochs != null
      ? Math.min(100, (elapsedEpochs / totalEpochs) * 100)
      : 0;

  // Trajectory
  const projectedFinalYesPct = computeTrajectory(powerByEpoch, totalActivePower, epochsRemaining);

  // InfoAction: no threshold
  if (proposalType === 'InfoAction' || thresholdPct == null) {
    return {
      currentYesPct,
      thresholdPct: null,
      powerGapAda: null,
      isPassing: false,
      participationPct,
      yesOfVotersPct,
      projectedFinalYesPct,
      epochsRemaining,
      votingPeriodPct,
      historicalPassRate,
      historicalSampleSize,
      historicalEvidence,
      projectedOutcome: 'no_threshold',
      confidence: 'high',
      confidenceReason: 'Advisory action — no binding threshold.',
      verdictLabel: 'Advisory',
      verdictDetail: `This is an advisory action with no binding threshold. ${
        totalActivePower > 0
          ? `Currently ${Math.round(currentYesPct)}% of voting power supports this proposal.`
          : 'No votes cast yet.'
      }`,
    };
  }

  // Determine outcome
  // progressRatio gates historical signals — base rate alone can't override massive gaps
  const trajectoryAbove = projectedFinalYesPct != null && projectedFinalYesPct >= thresholdPct;
  const baseRateFavorable = historicalPassRate != null && historicalPassRate >= 0.6;
  const baseRateUnfavorable = historicalPassRate != null && historicalPassRate < 0.4;
  const currentlyClose = Math.abs(currentYesPct - thresholdPct) < 10;
  const earlyStage = participationPct < 20;
  const veryEarlyStage = participationPct < 10;
  const noLeadsByPower = noPower > yesPower && votedPower > 0;

  let projectedOutcome: ProjectedOutcome;
  let verdictLabel: string;
  let verdictDetail: string;

  const yesAmongVoters = yesOfVotersPct != null ? Math.round(yesOfVotersPct) : null;
  const voterContext =
    yesAmongVoters != null && participationPct < 50
      ? ` Among those who have voted, ${yesAmongVoters}% voted Yes.`
      : '';

  if (isPassing) {
    projectedOutcome = 'passing';
    verdictLabel = 'Passing';
    const margin = (currentYesPct - thresholdPct).toFixed(1);
    verdictDetail = `Currently above the ${Math.round(thresholdPct)}% threshold by ${margin} percentage points.`;
  } else if (veryEarlyStage) {
    projectedOutcome = 'too_close';
    verdictLabel = 'Voting underway';
    verdictDetail = `${participationPct.toFixed(0)}% of active DRep stake has voted so far — too early for a reliable projection.${voterContext}`;
  } else if (noLeadsByPower && !earlyStage) {
    // No currently leads by voting power — respect the actual direction
    projectedOutcome = 'leaning_fail';
    verdictLabel = 'No currently leads';
    verdictDetail = `No holds more voting power than Yes.${voterContext} ${epochsRemaining != null ? `${epochsRemaining} epochs remaining for the balance to shift.` : ''}`;
  } else if (noLeadsByPower && earlyStage) {
    // No leads but still early
    projectedOutcome = 'too_close';
    verdictLabel = 'Contested — No leads early';
    verdictDetail = `No holds an early lead by voting power, but only ${participationPct.toFixed(0)}% of active stake has voted.${voterContext}`;
  } else if (trajectoryAbove && progressRatio > 0.5) {
    projectedOutcome = baseRateFavorable ? 'likely_pass' : 'leaning_pass';
    verdictLabel = baseRateFavorable ? 'Likely to pass' : 'Leaning toward passing';
    verdictDetail = `Trajectory projects ${Math.round(projectedFinalYesPct!)}% support by deadline (${Math.round(thresholdPct)}% needed).${voterContext}`;
  } else if (trajectoryAbove && earlyStage) {
    projectedOutcome = 'leaning_pass';
    verdictLabel = 'Early momentum';
    verdictDetail = `On pace to reach ${Math.round(projectedFinalYesPct!)}% support, but only ${participationPct.toFixed(0)}% of active stake has voted.${voterContext}`;
  } else if (currentlyClose) {
    projectedOutcome = 'too_close';
    verdictLabel = 'Too close to call';
    verdictDetail = `At ${currentYesPct.toFixed(1)}% — within striking distance of the ${Math.round(thresholdPct)}% threshold.${voterContext}`;
  } else if (progressRatio > 0.5 && baseRateFavorable) {
    projectedOutcome = 'leaning_pass';
    verdictLabel = 'Leaning toward passing';
    verdictDetail = `At ${currentYesPct.toFixed(1)}% of the ${Math.round(thresholdPct)}% needed, with historical patterns favoring passage.${voterContext}`;
  } else if (progressRatio < 0.3 && !earlyStage) {
    projectedOutcome = baseRateUnfavorable ? 'unlikely_pass' : 'leaning_fail';
    verdictLabel = baseRateUnfavorable ? 'Unlikely to pass' : 'Behind pace';
    verdictDetail = `At ${currentYesPct.toFixed(1)}% of the ${Math.round(thresholdPct)}% needed with ${epochsRemaining ?? '?'} epochs remaining.${voterContext}`;
  } else {
    projectedOutcome = 'too_close';
    verdictLabel = 'Too early to call';
    verdictDetail = `At ${currentYesPct.toFixed(1)}% of the ${Math.round(thresholdPct)}% needed.${voterContext}`;
  }

  // Confidence
  let confidence: 'high' | 'medium' | 'low';
  let confidenceReason: string;

  if (isPassing && currentYesPct - thresholdPct > 15) {
    confidence = 'high';
    confidenceReason = 'Strong margin above threshold.';
  } else if (historicalSampleSize >= 5 && projectedFinalYesPct != null) {
    confidence = 'medium';
    confidenceReason = `Based on ${historicalSampleSize} completed proposals and current voting trajectory.`;
  } else if (historicalSampleSize < 5) {
    confidence = 'low';
    confidenceReason = `Limited historical data (${historicalSampleSize} completed proposal${historicalSampleSize !== 1 ? 's' : ''} of this type).`;
  } else {
    confidence = 'medium';
    confidenceReason = 'Based on current voting trajectory.';
  }

  // Add power gap context to verdict
  if (powerGapAda != null && powerGapAda > 0 && !isPassing) {
    const gapStr =
      powerGapAda >= 1_000_000
        ? `${(powerGapAda / 1_000_000).toFixed(1)}M`
        : powerGapAda >= 1_000
          ? `${(powerGapAda / 1_000).toFixed(0)}K`
          : Math.round(powerGapAda).toLocaleString();
    verdictDetail += ` ${gapStr} more ADA of voting power needed.`;
  }

  return {
    currentYesPct,
    thresholdPct,
    powerGapAda,
    participationPct,
    yesOfVotersPct,
    isPassing,
    projectedFinalYesPct,
    epochsRemaining,
    votingPeriodPct,
    historicalPassRate,
    historicalSampleSize,
    historicalEvidence,
    projectedOutcome,
    confidence,
    confidenceReason,
    verdictLabel,
    verdictDetail,
  };
}
