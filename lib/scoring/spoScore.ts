/**
 * SPO Governance Score V3 — 4-pillar composite calculator.
 * Participation (35%) + Deliberation Quality (25%) + Reliability (25%) + Governance Identity (15%).
 * Confidence-weighted percentile normalization, proposal-aware reliability, 30-day momentum (ADR-006 V3).
 */

import { percentileNormalize } from './percentile';
import { percentileNormalizeWeighted } from './confidence';
import { DECAY_LAMBDA } from './types';

export const SPO_PILLAR_WEIGHTS = {
  participation: 0.35,
  deliberation: 0.25,
  reliability: 0.25,
  governanceIdentity: 0.15,
} as const;

export interface SpoVoteDataV3 {
  poolId: string;
  proposalKey: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  epoch: number;
  proposalType: string;
  importanceWeight: number;
  proposalBlockTime: number;
  hasRationale: boolean;
}

/** @deprecated Use SpoVoteDataV3 — kept for backward compat during migration */
export type SpoVoteData = SpoVoteDataV3;

export interface SpoScoreResult {
  composite: number;
  participationRaw: number;
  participationPercentile: number;
  deliberationRaw: number;
  deliberationPercentile: number;
  reliabilityRaw: number;
  reliabilityPercentile: number;
  governanceIdentityRaw: number;
  governanceIdentityPercentile: number;
  confidence: number;
  momentum: number | null;
  /** @deprecated V2 compat — same as deliberationRaw */
  consistencyRaw: number;
  /** @deprecated V2 compat — same as deliberationPercentile */
  consistencyPercentile: number;
}

/**
 * Compute SPO scores for all pools from vote data + identity + deliberation scores.
 * Proposal margin multipliers are applied globally (not per-SPO) for fair close-margin weighting.
 */
export function computeSpoScores(
  allVotes: SpoVoteDataV3[],
  totalProposalPool: number,
  currentEpoch: number,
  allProposalTypes: Set<string>,
  identityScores: Map<string, number>,
  deliberationScores: Map<string, number>,
  confidences: Map<string, number>,
  scoreHistory: Map<string, { date: string; score: number }[]>,
  proposalMarginMultipliers: Map<string, number>,
  activeEpochs: Set<number>,
): Map<string, SpoScoreResult> {
  const byPool = new Map<string, SpoVoteDataV3[]>();
  for (const v of allVotes) {
    const arr = byPool.get(v.poolId) ?? [];
    arr.push(v);
    byPool.set(v.poolId, arr);
  }

  const nowSeconds = allVotes.length > 0 ? Math.max(...allVotes.map((v) => v.blockTime)) : 0;

  const participationRaw = new Map<string, number>();
  const reliabilityRaw = new Map<string, number>();

  for (const [poolId, votes] of byPool) {
    participationRaw.set(
      poolId,
      computeParticipation(votes, totalProposalPool, nowSeconds, proposalMarginMultipliers),
    );
    reliabilityRaw.set(poolId, computeReliability(votes, currentEpoch, activeEpochs));
  }

  // Use confidence-weighted percentile normalization
  const participationPct = percentileNormalizeWeighted(participationRaw, confidences);
  const deliberationPct = percentileNormalizeWeighted(deliberationScores, confidences);
  const reliabilityPct = percentileNormalizeWeighted(reliabilityRaw, confidences);
  const identityPct = percentileNormalize(identityScores);

  const result = new Map<string, SpoScoreResult>();
  const allPoolIds = new Set([...byPool.keys(), ...identityScores.keys()]);

  for (const poolId of allPoolIds) {
    const pPct = participationPct.get(poolId) ?? 0;
    const dPct = deliberationPct.get(poolId) ?? 0;
    const rPct = reliabilityPct.get(poolId) ?? 0;
    const iPct = identityPct.get(poolId) ?? 0;

    const composite = Math.round(
      SPO_PILLAR_WEIGHTS.participation * pPct +
        SPO_PILLAR_WEIGHTS.deliberation * dPct +
        SPO_PILLAR_WEIGHTS.reliability * rPct +
        SPO_PILLAR_WEIGHTS.governanceIdentity * iPct,
    );

    const history = scoreHistory.get(poolId);
    const momentum = history ? computeMomentum(history) : null;
    const confidence = confidences.get(poolId) ?? 0;

    result.set(poolId, {
      composite: clamp(composite),
      participationRaw: participationRaw.get(poolId) ?? 0,
      participationPercentile: pPct,
      deliberationRaw: deliberationScores.get(poolId) ?? 0,
      deliberationPercentile: dPct,
      reliabilityRaw: reliabilityRaw.get(poolId) ?? 0,
      reliabilityPercentile: rPct,
      governanceIdentityRaw: identityScores.get(poolId) ?? 0,
      governanceIdentityPercentile: iPct,
      confidence,
      momentum,
      // V2 compat
      consistencyRaw: deliberationScores.get(poolId) ?? 0,
      consistencyPercentile: dPct,
    });
  }
  return result;
}

/**
 * Participation: importance-weighted vote coverage with temporal decay.
 * Close-margin bonus is now applied at the proposal level (via proposalMarginMultipliers),
 * not per-SPO, removing the luck factor.
 */
function computeParticipation(
  votes: SpoVoteDataV3[],
  totalProposalPool: number,
  nowSeconds: number,
  proposalMarginMultipliers: Map<string, number>,
): number {
  if (totalProposalPool === 0) return 0;
  const seen = new Set<string>();
  let weighted = 0;

  for (const v of votes) {
    if (seen.has(v.proposalKey)) continue;
    seen.add(v.proposalKey);
    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const marginMult = proposalMarginMultipliers.get(v.proposalKey) ?? 1;
    weighted += v.importanceWeight * decay * marginMult;
  }

  return Math.min(100, (weighted / totalProposalPool) * 100);
}

/**
 * Reliability V3: proposal-aware gaps, uniform temporal decay, engagement consistency.
 *
 * Sub-components:
 * - Active streak (30%): consecutive epochs with votes, only counting proposal-active epochs
 * - Recency (25%): exponential decay from last vote
 * - Gap penalty (15%): longest gap in proposal-active epochs only
 * - Engagement consistency (15%): CV of votes-per-active-epoch (steady > bursty)
 * - Tenure (15%): asymptotic curve with 20-point floor
 */
function computeReliability(
  votes: SpoVoteDataV3[],
  currentEpoch: number,
  activeEpochs: Set<number>,
): number {
  const votedEpochs = new Set(votes.map((v) => v.epoch));
  const sortedVotedEpochs = [...votedEpochs].sort((a, b) => a - b);
  if (sortedVotedEpochs.length === 0) return 0;

  const firstEpoch = sortedVotedEpochs[0];
  const lastEpoch = sortedVotedEpochs[sortedVotedEpochs.length - 1];
  const epochsSinceFirst = currentEpoch - firstEpoch;
  const epochsSinceLastVote = currentEpoch - lastEpoch;

  // Active streak: consecutive proposal-active epochs with votes (counting back from current)
  let streak = 0;
  for (let e = currentEpoch; e >= firstEpoch; e--) {
    if (!activeEpochs.has(e)) continue; // skip epochs with no proposals
    if (votedEpochs.has(e)) streak++;
    else break;
  }

  // Gap penalty: longest run of proposal-active epochs without a vote
  let longestGap = 0;
  let gap = 0;
  for (let e = firstEpoch; e <= currentEpoch; e++) {
    if (!activeEpochs.has(e)) continue; // skip epochs with no proposals
    if (votedEpochs.has(e)) {
      longestGap = Math.max(longestGap, gap);
      gap = 0;
    } else {
      gap++;
    }
  }
  longestGap = Math.max(longestGap, gap);

  // Engagement consistency: coefficient of variation of votes-per-active-epoch
  const activeEpochsInRange = [...activeEpochs].filter((e) => e >= firstEpoch && e <= currentEpoch);
  let consistencyScore = 50; // default
  if (activeEpochsInRange.length >= 3) {
    const votesPerEpoch = activeEpochsInRange.map((e) => votes.filter((v) => v.epoch === e).length);
    const mean = votesPerEpoch.reduce((a, b) => a + b, 0) / votesPerEpoch.length;
    if (mean > 0) {
      const variance =
        votesPerEpoch.reduce((sum, v) => sum + (v - mean) ** 2, 0) / votesPerEpoch.length;
      const cv = Math.sqrt(variance) / mean;
      // Low CV = consistent = high score. CV of 0 = 100, CV of 2+ = ~20
      consistencyScore = clamp(Math.round(100 * Math.exp(-cv)));
    }
  }

  const activeStreakScore = Math.min(streak * 15, 100);
  const recencyScore = 100 * Math.exp(-epochsSinceLastVote / 5);
  const gapScore = Math.max(0, 100 - longestGap * 15);
  const tenureScore = Math.min(20 + 80 * (1 - Math.exp(-epochsSinceFirst / 30)), 100);

  return (
    activeStreakScore * 0.3 +
    recencyScore * 0.25 +
    gapScore * 0.15 +
    consistencyScore * 0.15 +
    tenureScore * 0.15
  );
}

/**
 * Compute close-margin multipliers at the PROPOSAL level (not per-SPO).
 * Returns a map of proposalKey -> multiplier (1.0 for normal, 1.5 for contentious).
 * This is applied globally so all SPOs benefit equally from contentious proposals.
 */
export function computeProposalMarginMultipliers(allVotes: SpoVoteDataV3[]): Map<string, number> {
  const byProposal = new Map<string, { yes: number; no: number }>();
  for (const v of allVotes) {
    if (v.vote === 'Abstain') continue;
    const cur = byProposal.get(v.proposalKey) ?? { yes: 0, no: 0 };
    if (v.vote === 'Yes') cur.yes++;
    else cur.no++;
    byProposal.set(v.proposalKey, cur);
  }

  const result = new Map<string, number>();
  for (const [key, counts] of byProposal) {
    const total = counts.yes + counts.no;
    if (total === 0) {
      result.set(key, 1);
      continue;
    }
    const margin = Math.abs(counts.yes / total - counts.no / total);
    result.set(key, margin < 0.2 ? 1.5 : 1);
  }
  return result;
}

/**
 * Linear regression slope from recent score history.
 * Extended to 30-day window (vs 14 in V2) for more data points.
 * Requires minimum 3 data points (vs 2 in V2).
 */
function computeMomentum(history: { date: string; score: number }[]): number | null {
  if (history.length < 3) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = history.filter((h) => h.date >= cutoffStr);
  if (recent.length < 3) return null;

  const baseDate = new Date(recent[0].date).getTime();
  const points = recent.map((h) => ({
    x: (new Date(h.date).getTime() - baseDate) / 86400000,
    y: h.score,
  }));

  const n = points.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  return Math.round(slope * 100) / 100;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
