/**
 * SPO Governance Score V2 — 4-pillar composite calculator.
 * Participation (38%) + Consistency (24%) + Reliability (23%) + Governance Identity (15%).
 * Percentile-normalized, with momentum and close-margin bonus (ADR-006).
 */

import { percentileNormalize } from './percentile';
import { DECAY_LAMBDA } from './types';

export const SPO_PILLAR_WEIGHTS = {
  participation: 0.38,
  consistency: 0.24,
  reliability: 0.23,
  governanceIdentity: 0.15,
} as const;

export interface SpoVoteData {
  poolId: string;
  proposalKey: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  epoch: number;
  proposalType: string;
  importanceWeight: number;
  proposalBlockTime: number;
}

export interface SpoScoreResult {
  composite: number;
  participationRaw: number;
  participationPercentile: number;
  consistencyRaw: number;
  consistencyPercentile: number;
  reliabilityRaw: number;
  reliabilityPercentile: number;
  governanceIdentityRaw: number;
  governanceIdentityPercentile: number;
  momentum: number | null;
}

/**
 * Compute SPO scores for all pools from vote data + identity scores.
 * Identity scores are computed externally via computeSpoGovernanceIdentity().
 */
export function computeSpoScores(
  allVotes: SpoVoteData[],
  totalProposalPool: number,
  currentEpoch: number,
  allProposalTypes: Set<string>,
  identityScores: Map<string, number>,
  scoreHistory: Map<string, { date: string; score: number }[]>,
): Map<string, SpoScoreResult> {
  const byPool = new Map<string, SpoVoteData[]>();
  for (const v of allVotes) {
    const arr = byPool.get(v.poolId) ?? [];
    arr.push(v);
    byPool.set(v.poolId, arr);
  }

  const nowSeconds = allVotes.length > 0 ? Math.max(...allVotes.map((v) => v.blockTime)) : 0;
  const totalTypes = allProposalTypes.size || 1;

  const spoMajorityByProposal = computeSpoMajorityByProposal(allVotes);
  const spoMarginByProposal = computeSpoMarginByProposal(allVotes);

  const participationRaw = new Map<string, number>();
  const consistencyRaw = new Map<string, number>();
  const reliabilityRaw = new Map<string, number>();

  for (const [poolId, votes] of byPool) {
    participationRaw.set(
      poolId,
      computeParticipation(votes, totalProposalPool, nowSeconds, spoMarginByProposal),
    );
    consistencyRaw.set(poolId, computeConsistency(votes, spoMajorityByProposal, totalTypes));
    reliabilityRaw.set(poolId, computeReliability(votes, currentEpoch));
  }

  const participationPct = percentileNormalize(participationRaw);
  const consistencyPct = percentileNormalize(consistencyRaw);
  const reliabilityPct = percentileNormalize(reliabilityRaw);
  const identityPct = percentileNormalize(identityScores);

  const result = new Map<string, SpoScoreResult>();

  const allPoolIds = new Set([...byPool.keys(), ...identityScores.keys()]);

  for (const poolId of allPoolIds) {
    const pPct = participationPct.get(poolId) ?? 0;
    const cPct = consistencyPct.get(poolId) ?? 0;
    const rPct = reliabilityPct.get(poolId) ?? 0;
    const iPct = identityPct.get(poolId) ?? 0;

    const composite = Math.round(
      SPO_PILLAR_WEIGHTS.participation * pPct +
        SPO_PILLAR_WEIGHTS.consistency * cPct +
        SPO_PILLAR_WEIGHTS.reliability * rPct +
        SPO_PILLAR_WEIGHTS.governanceIdentity * iPct,
    );

    const history = scoreHistory.get(poolId);
    const momentum = history ? computeMomentum(history) : null;

    result.set(poolId, {
      composite: clamp(composite),
      participationRaw: participationRaw.get(poolId) ?? 0,
      participationPercentile: pPct,
      consistencyRaw: consistencyRaw.get(poolId) ?? 0,
      consistencyPercentile: cPct,
      reliabilityRaw: reliabilityRaw.get(poolId) ?? 0,
      reliabilityPercentile: rPct,
      governanceIdentityRaw: identityScores.get(poolId) ?? 0,
      governanceIdentityPercentile: iPct,
      momentum,
    });
  }
  return result;
}

function computeParticipation(
  votes: SpoVoteData[],
  totalProposalPool: number,
  nowSeconds: number,
  spoMarginByProposal: Map<string, number>,
): number {
  if (totalProposalPool === 0) return 0;
  const seen = new Set<string>();
  let weighted = 0;
  for (const v of votes) {
    if (seen.has(v.proposalKey)) continue;
    seen.add(v.proposalKey);
    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);

    let weight = v.importanceWeight * decay;

    const margin = spoMarginByProposal.get(v.proposalKey);
    if (margin !== undefined && margin < 0.2) {
      weight *= 1.5;
    }

    weighted += weight;
  }
  return Math.min(100, (weighted / totalProposalPool) * 100);
}

function computeConsistency(
  votes: SpoVoteData[],
  spoMajorityByProposal: Map<string, 'Yes' | 'No' | 'Abstain'>,
  totalTypes: number,
): number {
  if (votes.length === 0) return 0;

  const yesCount = votes.filter((v) => v.vote === 'Yes').length;
  const noCount = votes.filter((v) => v.vote === 'No').length;
  const yesRate = yesCount / votes.length;
  const noRate = noCount / votes.length;
  const maxRate = Math.max(yesRate, noRate);
  let diversityScore: number;
  if (maxRate > 0.85) {
    diversityScore = Math.max(0, 100 - (maxRate - 0.85) * 500);
  } else {
    diversityScore = 100;
  }

  const distinctTypes = new Set(votes.map((v) => v.proposalType)).size;
  const typeBreadthScore = (distinctTypes / totalTypes) * 100;

  let dissentCount = 0;
  for (const v of votes) {
    const majority = spoMajorityByProposal.get(v.proposalKey);
    if (majority && v.vote !== majority) dissentCount++;
  }
  const dissentRate = dissentCount / votes.length;
  let dissentScore: number;
  if (dissentRate >= 0.15 && dissentRate <= 0.4) {
    dissentScore = 100;
  } else if (dissentRate < 0.15) {
    dissentScore = (dissentRate / 0.15) * 100;
  } else {
    dissentScore = Math.max(0, 100 - (dissentRate - 0.4) * 250);
  }

  return (diversityScore + typeBreadthScore + dissentScore) / 3;
}

function computeSpoMajorityByProposal(
  allVotes: SpoVoteData[],
): Map<string, 'Yes' | 'No' | 'Abstain'> {
  const byProposal = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of allVotes) {
    const cur = byProposal.get(v.proposalKey) ?? { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') cur.yes++;
    else if (v.vote === 'No') cur.no++;
    else cur.abstain++;
    byProposal.set(v.proposalKey, cur);
  }
  const result = new Map<string, 'Yes' | 'No' | 'Abstain'>();
  for (const [key, counts] of byProposal) {
    const max = Math.max(counts.yes, counts.no, counts.abstain);
    if (counts.yes === max) result.set(key, 'Yes');
    else if (counts.no === max) result.set(key, 'No');
    else result.set(key, 'Abstain');
  }
  return result;
}

/**
 * Compute vote margin for close-margin bonus.
 * Margin = |yesRate - noRate| among non-abstain votes.
 */
function computeSpoMarginByProposal(allVotes: SpoVoteData[]): Map<string, number> {
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
    result.set(key, Math.abs(counts.yes / total - counts.no / total));
  }
  return result;
}

function computeReliability(votes: SpoVoteData[], currentEpoch: number): number {
  const epochs = [...new Set(votes.map((v) => v.epoch))].sort((a, b) => a - b);
  if (epochs.length === 0) return 0;

  const firstEpoch = epochs[0];
  const lastEpoch = epochs[epochs.length - 1];
  const epochsSinceFirst = currentEpoch - firstEpoch;
  const epochsSinceLastVote = currentEpoch - lastEpoch;

  let streak = 0;
  for (let e = currentEpoch; e >= firstEpoch; e--) {
    if (epochs.includes(e)) streak++;
    else break;
  }

  let longestGap = 0;
  let gap = 0;
  for (let e = firstEpoch; e <= currentEpoch; e++) {
    if (epochs.includes(e)) {
      longestGap = Math.max(longestGap, gap);
      gap = 0;
    } else {
      gap++;
    }
  }
  longestGap = Math.max(longestGap, gap);

  const activeStreakScore = Math.min(streak * 15, 100);
  const recencyScore = 100 * Math.exp(-epochsSinceLastVote / 5);
  const gapScore = Math.max(0, 100 - longestGap * 15);

  // Responsiveness: median days from proposal creation to vote
  const responseDays: number[] = [];
  for (const v of votes) {
    if (v.proposalBlockTime > 0 && v.blockTime > v.proposalBlockTime) {
      responseDays.push((v.blockTime - v.proposalBlockTime) / 86400);
    }
  }
  let responsivenessScore = 50; // default if no data
  if (responseDays.length > 0) {
    responseDays.sort((a, b) => a - b);
    const medianDays = responseDays[Math.floor(responseDays.length / 2)];
    responsivenessScore = 100 * Math.exp(-medianDays / 14);
  }

  const tenureScore = Math.min(20 + 80 * (1 - Math.exp(-epochsSinceFirst / 30)), 100);

  return (
    activeStreakScore * 0.3 +
    recencyScore * 0.25 +
    gapScore * 0.15 +
    responsivenessScore * 0.15 +
    tenureScore * 0.15
  );
}

/**
 * Linear regression slope from recent score history (same as DRep momentum).
 */
function computeMomentum(history: { date: string; score: number }[]): number | null {
  if (history.length < 2) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = history.filter((h) => h.date >= cutoffStr);
  if (recent.length < 2) return null;

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
