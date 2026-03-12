/**
 * Reliability pillar (25% of DRep Score).
 * "Can I count on this DRep to keep showing up?"
 *
 * 4 sub-components: Streak (35%), Recency (30%), Gap (25%), Tenure (10%).
 * Timeliness removed — voting within the window is sufficient.
 */

import type { VoteData } from './types';
import { RELIABILITY_WEIGHTS, RELIABILITY_PARAMS } from './calibration';

const WEIGHTS = RELIABILITY_WEIGHTS;

export interface ReliabilityV3Result {
  score: number;
  streak: number;
  recency: number;
  longestGap: number;
  tenure: number;
}

/**
 * Compute raw Reliability scores (0-100) for all DReps.
 *
 * @param drepVotes Map of drepId → their votes (with blockTime + proposalBlockTime)
 * @param proposalEpochs Map of epoch → proposal count (epochs that had proposals)
 * @param currentEpoch Current Cardano epoch number
 * @param drepEpochData Map of drepId → { counts, firstEpoch } (epoch vote counts)
 */
export function computeReliability(
  drepVotes: Map<string, VoteData[]>,
  proposalEpochs: Map<number, number>,
  currentEpoch: number,
  drepEpochData: Map<string, { counts: number[]; firstEpoch: number }>,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [drepId, votes] of drepVotes) {
    const epochData = drepEpochData.get(drepId);

    if (!epochData || votes.length === 0) {
      scores.set(drepId, 0);
      continue;
    }

    const result = computeSingleDRepReliability(
      votes,
      epochData.counts,
      epochData.firstEpoch,
      currentEpoch,
      proposalEpochs,
    );

    scores.set(drepId, result.score);
  }

  return scores;
}

function computeSingleDRepReliability(
  votes: VoteData[],
  epochVoteCounts: number[],
  firstEpoch: number,
  currentEpoch: number,
  proposalEpochs: Map<number, number>,
): ReliabilityV3Result {
  const zero: ReliabilityV3Result = {
    score: 0,
    streak: 0,
    recency: 999,
    longestGap: 0,
    tenure: 0,
  };

  if (!epochVoteCounts || epochVoteCounts.length === 0) return zero;

  const votedEpochs = new Set<number>();
  for (let i = 0; i < epochVoteCounts.length; i++) {
    if (epochVoteCounts[i] > 0) votedEpochs.add(firstEpoch + i);
  }
  if (votedEpochs.size === 0) return zero;

  const hasProposalData = proposalEpochs.size > 0;
  const epochHadProposals = (e: number) => !hasProposalData || (proposalEpochs.get(e) ?? 0) > 0;

  const lastVotedEpoch = Math.max(...votedEpochs);

  // 1. Active Streak (30%) — consecutive epochs with votes counting backwards
  let streak = 0;
  for (let e = currentEpoch; e >= firstEpoch; e--) {
    if (!epochHadProposals(e)) continue;
    if (votedEpochs.has(e)) {
      streak++;
    } else {
      break;
    }
  }
  const streakScore = Math.min(100, streak * RELIABILITY_PARAMS.streakPointsPerEpoch);

  // 2. Recency (25%) — exponential decay from last vote
  const recency = Math.max(0, currentEpoch - lastVotedEpoch);
  const recencyScore = Math.round(
    100 * Math.exp(-recency / RELIABILITY_PARAMS.recencyDecayDivisor),
  );

  // 3. Gap Penalty (20%) — longest run of proposal-epochs without a vote
  let longestGap = 0;
  let currentGap = 0;
  for (let e = firstEpoch; e <= currentEpoch; e++) {
    if (!epochHadProposals(e)) continue;
    if (votedEpochs.has(e)) {
      longestGap = Math.max(longestGap, currentGap);
      currentGap = 0;
    } else {
      currentGap++;
    }
  }
  longestGap = Math.max(longestGap, currentGap);
  const gapScore = Math.max(0, 100 - longestGap * RELIABILITY_PARAMS.gapPenaltyPerEpoch);

  // 4. Tenure (10%) — epochs since first vote, diminishing returns
  const tenure = Math.max(0, currentEpoch - firstEpoch);
  const tenureScore = Math.min(
    100,
    Math.round(
      RELIABILITY_PARAMS.tenureFloor +
        RELIABILITY_PARAMS.tenureGrowth *
          (1 - Math.exp(-tenure / RELIABILITY_PARAMS.tenureDecayEpochs)),
    ),
  );

  const combined = Math.round(
    streakScore * WEIGHTS.streak +
      recencyScore * WEIGHTS.recency +
      gapScore * WEIGHTS.gap +
      tenureScore * WEIGHTS.tenure,
  );

  return {
    score: clamp(combined),
    streak,
    recency,
    longestGap,
    tenure,
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
