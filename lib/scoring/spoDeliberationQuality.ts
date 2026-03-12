/**
 * SPO Deliberation Quality pillar (25% of SPO Score V3).
 *
 * Two sub-components:
 * - Rationale Provision (55%): % of votes with rationale, importance-weighted
 * - Proposal Coverage Entropy (45%): Shannon entropy across proposal types
 *
 * Timeliness removed — voting within the window is sufficient.
 */

import { DECAY_LAMBDA } from './types';

const SUB_WEIGHTS = { rationaleProvision: 0.55, coverageEntropy: 0.45 };
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
    const entropy = computeCoverageEntropy(votes, allProposalTypes);

    const raw = provision * SUB_WEIGHTS.rationaleProvision + entropy * SUB_WEIGHTS.coverageEntropy;

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
