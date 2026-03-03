import { percentileNormalize } from './percentile';
import { DECAY_LAMBDA } from './types';

export const SPO_PILLAR_WEIGHTS = {
  participation: 0.45,
  consistency: 0.3,
  reliability: 0.25,
} as const;

export interface SpoVoteData {
  poolId: string;
  proposalKey: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  epoch: number;
  proposalType: string;
  importanceWeight: number;
}

export interface SpoScoreResult {
  composite: number;
  participationRaw: number;
  participationPercentile: number;
  consistencyRaw: number;
  consistencyPercentile: number;
  reliabilityRaw: number;
  reliabilityPercentile: number;
}

export function computeSpoScores(
  allVotes: SpoVoteData[],
  totalProposalPool: number,
  currentEpoch: number,
  allProposalTypes: Set<string>,
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

  const participationRaw = new Map<string, number>();
  const consistencyRaw = new Map<string, number>();
  const reliabilityRaw = new Map<string, number>();

  for (const [poolId, votes] of byPool) {
    participationRaw.set(poolId, computeParticipation(votes, totalProposalPool, nowSeconds));
    consistencyRaw.set(poolId, computeConsistency(votes, spoMajorityByProposal, totalTypes));
    reliabilityRaw.set(poolId, computeReliability(votes, currentEpoch));
  }

  const participationPct = percentileNormalize(participationRaw);
  const consistencyPct = percentileNormalize(consistencyRaw);
  const reliabilityPct = percentileNormalize(reliabilityRaw);

  const result = new Map<string, SpoScoreResult>();
  for (const poolId of byPool.keys()) {
    const p = participationRaw.get(poolId) ?? 0;
    const c = consistencyRaw.get(poolId) ?? 0;
    const r = reliabilityRaw.get(poolId) ?? 0;
    const composite = Math.min(
      100,
      Math.max(
        0,
        SPO_PILLAR_WEIGHTS.participation * (participationPct.get(poolId) ?? 0) +
          SPO_PILLAR_WEIGHTS.consistency * (consistencyPct.get(poolId) ?? 0) +
          SPO_PILLAR_WEIGHTS.reliability * (reliabilityPct.get(poolId) ?? 0),
      ),
    );
    result.set(poolId, {
      composite: Math.round(composite),
      participationRaw: p,
      participationPercentile: participationPct.get(poolId) ?? 0,
      consistencyRaw: c,
      consistencyPercentile: consistencyPct.get(poolId) ?? 0,
      reliabilityRaw: r,
      reliabilityPercentile: reliabilityPct.get(poolId) ?? 0,
    });
  }
  return result;
}

function computeParticipation(
  votes: SpoVoteData[],
  totalProposalPool: number,
  nowSeconds: number,
): number {
  if (totalProposalPool === 0) return 0;
  const seen = new Set<string>();
  let weighted = 0;
  for (const v of votes) {
    if (seen.has(v.proposalKey)) continue;
    seen.add(v.proposalKey);
    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    weighted += v.importanceWeight * decay;
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
  const tenureScore = Math.min(Math.sqrt(Math.max(0, epochsSinceFirst)) * 20, 100);

  return activeStreakScore * 0.35 + recencyScore * 0.3 + gapScore * 0.2 + tenureScore * 0.15;
}
