/**
 * SPO Deliberation Quality pillar (25% of SPO Score V3).
 * Replaces the broken Consistency pillar from V2.
 *
 * Three sub-components:
 * - Rationale Provision (40%): % of votes with rationale, importance-weighted
 * - Vote Timing Distribution (30%): stddev of time-to-vote (bot/human detection)
 * - Proposal Coverage Entropy (30%): Shannon entropy across proposal types
 */

import { DECAY_LAMBDA } from './types';

const SUB_WEIGHTS = { rationaleProvision: 0.4, timingDistribution: 0.3, coverageEntropy: 0.3 };
const INFO_ACTION = 'InfoAction';

export interface SpoDeliberationVoteData {
  proposalKey: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  proposalBlockTime: number;
  proposalType: string;
  importanceWeight: number;
  hasRationale: boolean;
}

/**
 * Compute raw Deliberation Quality scores (0-100) for all SPOs.
 */
export function computeSpoDeliberationQuality(
  poolVotes: Map<string, SpoDeliberationVoteData[]>,
  allProposalTypes: Set<string>,
  nowSeconds: number,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [poolId, votes] of poolVotes) {
    if (votes.length === 0) {
      scores.set(poolId, 0);
      continue;
    }

    const provision = computeRationaleProvision(votes, nowSeconds);
    const timing = computeTimingDistribution(votes);
    const entropy = computeCoverageEntropy(votes, allProposalTypes);

    const raw =
      provision * SUB_WEIGHTS.rationaleProvision +
      timing * SUB_WEIGHTS.timingDistribution +
      entropy * SUB_WEIGHTS.coverageEntropy;

    scores.set(poolId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Rationale Provision (40%): importance-weighted % of votes with rationale.
 * InfoActions excluded. SPOs with 0 rationales score 0.
 */
function computeRationaleProvision(votes: SpoDeliberationVoteData[], nowSeconds: number): number {
  let weightedHas = 0;
  let totalWeight = 0;

  for (const v of votes) {
    if (v.proposalType === INFO_ACTION) continue;

    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const w = v.importanceWeight * decay;

    totalWeight += w;
    if (v.hasRationale) {
      weightedHas += w;
    }
  }

  return totalWeight === 0 ? 0 : (weightedHas / totalWeight) * 100;
}

/**
 * Vote Timing Distribution (30%): standard deviation of time-to-vote.
 * Penalizes bot-like patterns (near-zero stddev) and extreme variance.
 * Natural human deliberation variance (~3 days stddev) scores highest.
 */
function computeTimingDistribution(votes: SpoDeliberationVoteData[]): number {
  const responseDays: number[] = [];
  for (const v of votes) {
    if (v.proposalBlockTime > 0 && v.blockTime > v.proposalBlockTime) {
      responseDays.push((v.blockTime - v.proposalBlockTime) / 86400);
    }
  }

  if (responseDays.length < 3) return 50; // insufficient data

  const mean = responseDays.reduce((a, b) => a + b, 0) / responseDays.length;
  const variance = responseDays.reduce((sum, d) => sum + (d - mean) ** 2, 0) / responseDays.length;
  const stddev = Math.sqrt(variance);

  // Target stddev: ~3 days of natural variation
  const TARGET_STDDEV = 3;

  // Score: peaks at target, decays on both sides
  // Low stddev (bot-like): steep penalty
  // High stddev (erratic): gradual penalty
  const riseScore = 1 - Math.exp(-stddev / TARGET_STDDEV);
  const decayScore = Math.exp(-Math.max(0, stddev - 3 * TARGET_STDDEV) / (2 * TARGET_STDDEV));

  return clamp(Math.round(riseScore * decayScore * 100));
}

/**
 * Proposal Coverage Entropy (30%): Shannon entropy across proposal types.
 * Balanced engagement across types > token engagement across all types.
 * Normalized to 0-100 by dividing by max possible entropy.
 */
function computeCoverageEntropy(
  votes: SpoDeliberationVoteData[],
  allProposalTypes: Set<string>,
): number {
  if (votes.length === 0 || allProposalTypes.size === 0) return 0;

  const typeCounts = new Map<string, number>();
  for (const v of votes) {
    typeCounts.set(v.proposalType, (typeCounts.get(v.proposalType) ?? 0) + 1);
  }

  const totalVotes = votes.length;
  let entropy = 0;

  for (const count of typeCounts.values()) {
    const p = count / totalVotes;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize by max possible entropy (uniform distribution across all types)
  const maxEntropy = Math.log2(allProposalTypes.size);
  if (maxEntropy === 0) return 50;

  return clamp(Math.round((entropy / maxEntropy) * 100));
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
