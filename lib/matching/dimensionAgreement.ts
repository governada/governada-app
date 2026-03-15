/**
 * Dimension-level agreement between a user's alignment profile and a DRep's alignment scores.
 * Uses the simplified approach: per-dimension delta = 100 - |userScore - drepScore|.
 */

import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';

export const AGREE_THRESHOLD = 70;
export const DIFFER_THRESHOLD = 40;

export const DIMENSION_LABELS: Record<AlignmentDimension, string> = {
  treasuryConservative: 'Treasury Conservative',
  treasuryGrowth: 'Treasury Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

export const DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

export interface DimensionAgreementResult {
  dimensionAgreement: Record<AlignmentDimension, number>;
  agreeDimensions: string[];
  differDimensions: string[];
}

export function computeDimensionAgreement(
  userScores: AlignmentScores,
  drepScores: AlignmentScores,
): DimensionAgreementResult {
  const dimensionAgreement = {} as Record<AlignmentDimension, number>;
  const agreeDimensions: string[] = [];
  const differDimensions: string[] = [];

  for (const dim of DIMENSIONS) {
    const userVal = userScores[dim] ?? 50;
    const drepVal = drepScores[dim] ?? 50;
    const agreement = Math.round(100 - Math.abs(userVal - drepVal));
    dimensionAgreement[dim] = agreement;

    if (agreement >= AGREE_THRESHOLD) {
      agreeDimensions.push(DIMENSION_LABELS[dim]);
    } else if (agreement < DIFFER_THRESHOLD) {
      differDimensions.push(DIMENSION_LABELS[dim]);
    }
  }

  return { dimensionAgreement, agreeDimensions, differDimensions };
}

/**
 * Derive a user's approximate alignment scores from their poll votes
 * and proposal classifications. Used when no stored user profile exists.
 */
export function deriveUserAlignments(
  pollVotes: { proposal_tx_hash: string; proposal_index: number; vote: string }[],
  classifications: Map<string, Record<AlignmentDimension, number>>,
): AlignmentScores {
  const totals = {} as Record<AlignmentDimension, number>;
  const weights = {} as Record<AlignmentDimension, number>;

  for (const dim of DIMENSIONS) {
    totals[dim] = 0;
    weights[dim] = 0;
  }

  for (const pv of pollVotes) {
    const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
    const cls = classifications.get(key);
    if (!cls) continue;

    const voteVal = pv.vote.toLowerCase() === 'yes' ? 1 : pv.vote.toLowerCase() === 'no' ? 0 : 0.5;

    for (const dim of DIMENSIONS) {
      const relevance = cls[dim];
      if (relevance <= 0) continue;
      totals[dim] += voteVal * relevance;
      weights[dim] += relevance;
    }
  }

  const scores = {} as AlignmentScores;
  for (const dim of DIMENSIONS) {
    if (weights[dim] > 0) {
      scores[dim] = Math.round((totals[dim] / weights[dim]) * 100);
    } else {
      scores[dim] = null;
    }
  }

  return scores;
}
