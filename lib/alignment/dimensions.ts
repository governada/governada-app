/**
 * Redesigned 6 visual dimension formulas.
 * Each uses AI proposal classifications, temporal decay, and amount-weighting.
 */

import type { ProposalClassification } from './classifyProposals';

export interface DimensionInput {
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  hasRationale: boolean;
  rationaleQuality: number | null;
  proposalType: string;
  withdrawalAmountAda: number | null;
  classification: ProposalClassification | null;
}

export interface DRepContext {
  sizeTier: string;
  participationRate: number;
  rationaleRate: number;
  totalVotes: number;
}

export interface DimensionScores {
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
}

const HALF_LIFE_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const LAMBDA = Math.LN2 / HALF_LIFE_MS;

function temporalDecay(blockTime: number, now: number): number {
  const age = now - blockTime * 1000;
  return Math.exp(-LAMBDA * Math.max(0, age));
}

function amountWeight(ada: number | null, maxAda: number): number {
  if (!ada || ada <= 0 || maxAda <= 0) return 1;
  return Math.log10(ada + 1) / Math.log10(maxAda + 1);
}

/**
 * Compute all 6 dimension raw scores (0-100) for a single DRep.
 */
export function computeDimensionScores(
  inputs: DimensionInput[],
  drep: DRepContext,
  opts?: { now?: number },
): DimensionScores {
  const now = opts?.now ?? Date.now();
  const maxAda = Math.max(
    1,
    ...inputs.filter((i) => i.withdrawalAmountAda).map((i) => i.withdrawalAmountAda!),
  );

  return {
    treasuryConservative: calcTreasuryConservative(inputs, now, maxAda),
    treasuryGrowth: calcTreasuryGrowth(inputs, now, maxAda),
    decentralization: calcDecentralization(inputs, drep, now),
    security: calcSecurity(inputs, drep, now),
    innovation: calcInnovation(inputs, drep, now),
    transparency: calcTransparency(inputs, drep),
  };
}

function calcTreasuryConservative(
  inputs: DimensionInput[],
  now: number,
  maxAda: number,
): number | null {
  const relevant = inputs.filter((i) => (i.classification?.dimTreasuryConservative ?? 0) > 0.2);
  if (relevant.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const input of relevant) {
    const relevance = input.classification?.dimTreasuryConservative ?? 0;
    const decay = temporalDecay(input.blockTime, now);
    const amt = amountWeight(input.withdrawalAmountAda, maxAda);
    const weight = relevance * decay * amt;

    let direction: number;
    if (input.vote === 'No') direction = 1;
    else if (input.vote === 'Yes') direction = 0;
    else direction = 0.6; // Abstain leans slightly conservative

    weightedSum += direction * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100);
}

function calcTreasuryGrowth(inputs: DimensionInput[], now: number, maxAda: number): number | null {
  const relevant = inputs.filter((i) => (i.classification?.dimTreasuryGrowth ?? 0) > 0.2);
  if (relevant.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const input of relevant) {
    const relevance = input.classification?.dimTreasuryGrowth ?? 0;
    const decay = temporalDecay(input.blockTime, now);
    const amt = amountWeight(input.withdrawalAmountAda, maxAda);
    const weight = relevance * decay * amt;

    let direction: number;
    if (input.vote === 'Yes') {
      // Rationale quality bonus: 0.6 base + up to 0.4 from quality
      const qualityBonus =
        input.rationaleQuality != null
          ? (input.rationaleQuality / 100) * 0.4
          : input.hasRationale
            ? 0.2
            : 0;
      direction = 0.6 + qualityBonus;
    } else if (input.vote === 'No') {
      direction = input.hasRationale ? 0.3 : 0.1;
    } else {
      direction = 0.4;
    }

    weightedSum += direction * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;
  return Math.round((weightedSum / totalWeight) * 100);
}

function calcDecentralization(
  inputs: DimensionInput[],
  drep: DRepContext,
  now: number,
): number | null {
  // Vote pattern on decentralization-relevant proposals
  const relevant = inputs.filter((i) => (i.classification?.dimDecentralization ?? 0) > 0.2);

  if (relevant.length === 0 && inputs.length === 0) return null;

  let voteScore = 50;
  if (relevant.length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const input of relevant) {
      const relevance = input.classification?.dimDecentralization ?? 0;
      const decay = temporalDecay(input.blockTime, now);
      const weight = relevance * decay;

      // For governance/committee proposals, voting No/Abstain shows decentralization concern
      let direction: number;
      if (
        input.proposalType === 'NoConfidence' ||
        input.proposalType === 'NewConstitutionalCommittee'
      ) {
        direction = input.vote === 'Yes' ? 0.8 : input.vote === 'No' ? 0.5 : 0.6;
      } else {
        direction = input.vote === 'Yes' ? 0.6 : input.vote === 'No' ? 0.5 : 0.5;
      }

      weightedSum += direction * weight;
      totalWeight += weight;
    }

    voteScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 50;
  }

  // Voting breadth bonus (more diverse proposal types = more engaged in governance)
  const proposalTypes = new Set(inputs.map((i) => i.proposalType));
  const breadthBonus = Math.min(8, proposalTypes.size * 2);

  return clamp(voteScore + breadthBonus);
}

function calcSecurity(inputs: DimensionInput[], drep: DRepContext, now: number): number | null {
  const relevant = inputs.filter((i) => (i.classification?.dimSecurity ?? 0) > 0.2);

  if (relevant.length === 0) {
    return null;
  }

  // Caution rate: No/Abstain on security proposals
  let cautionCount = 0;
  let rationaleCount = 0;
  let totalWeight = 0;

  for (const input of relevant) {
    const relevance = input.classification?.dimSecurity ?? 0;
    const decay = temporalDecay(input.blockTime, now);
    const weight = relevance * decay;

    if (input.vote === 'No' || input.vote === 'Abstain') cautionCount += weight;
    const quality = input.rationaleQuality ?? (input.hasRationale ? 50 : 0);
    rationaleCount += (quality / 100) * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  const cautionRate = (cautionCount / totalWeight) * 100;
  const rationaleRate = (rationaleCount / totalWeight) * 100;
  const participationRate = Math.min(100, (relevant.length / Math.max(1, inputs.length)) * 100);

  return Math.round(cautionRate * 0.5 + rationaleRate * 0.3 + participationRate * 0.2);
}

function calcInnovation(inputs: DimensionInput[], drep: DRepContext, now: number): number | null {
  const relevant = inputs.filter((i) => (i.classification?.dimInnovation ?? 0) > 0.2);

  if (relevant.length === 0 && inputs.length === 0) return null;

  // Support rate on innovation proposals (0.4 weight)
  let supportScore = 50;
  if (relevant.length > 0) {
    let weightedYes = 0;
    let totalWeight = 0;

    for (const input of relevant) {
      const relevance = input.classification?.dimInnovation ?? 0;
      const decay = temporalDecay(input.blockTime, now);
      const weight = relevance * decay;

      if (input.vote === 'Yes') weightedYes += weight;
      totalWeight += weight;
    }

    supportScore = totalWeight > 0 ? Math.round((weightedYes / totalWeight) * 100) : 50;
  }

  // InfoAction engagement (0.3 weight)
  const infoActions = inputs.filter((i) => i.proposalType === 'InfoAction');
  const infoEngagement =
    infoActions.length > 0
      ? Math.min(100, (infoActions.length / Math.max(1, inputs.length)) * 200)
      : 0;

  // Voting breadth across proposal types (0.3 weight)
  const proposalTypes = new Set(inputs.map((i) => i.proposalType));
  const maxTypes = 8;
  const breadth = Math.min(100, (proposalTypes.size / maxTypes) * 100);

  return Math.round(supportScore * 0.4 + infoEngagement * 0.3 + breadth * 0.3);
}

function calcTransparency(inputs: DimensionInput[], drep: DRepContext): number | null {
  if (inputs.length === 0) return null;

  // AI rationale quality (0.6 weight)
  const withQuality = inputs.filter((i) => i.rationaleQuality != null);
  let avgQuality = 50;
  if (withQuality.length > 0) {
    avgQuality = withQuality.reduce((sum, i) => sum + i.rationaleQuality!, 0) / withQuality.length;
  } else if (inputs.length > 0) {
    // Fallback: binary rationale check
    const withRationale = inputs.filter((i) => i.hasRationale);
    avgQuality = (withRationale.length / inputs.length) * 70;
  }

  // Rationale provision rate (0.2 weight)
  const rationaleRate = drep.rationaleRate;

  // Metadata completeness proxy (0.2 weight): how many votes have rationale URLs
  const metaCompleteness =
    inputs.length > 0 ? (inputs.filter((i) => i.hasRationale).length / inputs.length) * 100 : 0;

  return Math.round(avgQuality * 0.6 + rationaleRate * 0.2 + metaCompleteness * 0.2);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
