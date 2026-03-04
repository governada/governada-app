/**
 * Alignment Drift Detection Engine.
 * Compares citizen governance profiles (6D) against their delegated
 * DRep's current alignment. Classifies drift severity and surfaces
 * alternative DRep suggestions when drift is high.
 */

export const ALIGNMENT_DIMENSIONS = [
  'treasury_conservative',
  'treasury_growth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

export type AlignmentDimension = (typeof ALIGNMENT_DIMENSIONS)[number];

export type Alignment6D = Record<AlignmentDimension, number>;

export type DriftClassification = 'low' | 'moderate' | 'high';

export interface DimensionDrift {
  dimension: AlignmentDimension;
  citizenValue: number;
  drepValue: number;
  delta: number;
}

export interface DriftResult {
  driftScore: number;
  classification: DriftClassification;
  dimensionDrifts: DimensionDrift[];
  worstDimension: AlignmentDimension | null;
}

const DIMENSION_WEIGHTS: Record<AlignmentDimension, number> = {
  treasury_conservative: 0.2,
  treasury_growth: 0.2,
  decentralization: 0.2,
  security: 0.15,
  innovation: 0.15,
  transparency: 0.1,
};

/**
 * Compute alignment drift between a citizen's governance profile and
 * their delegated DRep's voting alignment.
 *
 * Both inputs are 6D alignment vectors with values 0-100.
 * Drift score is a weighted aggregate of per-dimension distances (0-100 scale).
 */
export function computeAlignmentDrift(
  citizenAlignment: Alignment6D,
  drepAlignment: Alignment6D,
): DriftResult {
  const dimensionDrifts: DimensionDrift[] = [];
  let weightedSum = 0;
  let maxDelta = 0;
  let worstDimension: AlignmentDimension | null = null;

  for (const dim of ALIGNMENT_DIMENSIONS) {
    const citizenVal = citizenAlignment[dim] ?? 50;
    const drepVal = drepAlignment[dim] ?? 50;
    const delta = Math.abs(citizenVal - drepVal);

    dimensionDrifts.push({
      dimension: dim,
      citizenValue: citizenVal,
      drepValue: drepVal,
      delta,
    });

    weightedSum += delta * (DIMENSION_WEIGHTS[dim] ?? 1 / 6);

    if (delta > maxDelta) {
      maxDelta = delta;
      worstDimension = dim;
    }
  }

  const driftScore = Math.round(weightedSum);
  const classification = classifyDrift(driftScore);

  return {
    driftScore,
    classification,
    dimensionDrifts,
    worstDimension,
  };
}

function classifyDrift(score: number): DriftClassification {
  if (score <= 15) return 'low';
  if (score <= 30) return 'moderate';
  return 'high';
}
