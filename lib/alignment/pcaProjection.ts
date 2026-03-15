/**
 * PCA-to-Dimension Projection Bridge (QP-6 Hybrid Reconciliation).
 *
 * Projects PCA loadings into the 6 named governance dimensions using
 * proposal classifications. This ensures the radar display dimensions
 * are consistent with the PCA-based matching engine.
 *
 * When PCA data is unavailable or low-variance, falls back to manual
 * dimension computation from `dimensions.ts`.
 */

import type { ProposalClassification } from './classifyProposals';
import type { DimensionScores } from './dimensions';

type DimensionKey = keyof DimensionScores;

const DIMENSION_KEYS: DimensionKey[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

const CLASSIFICATION_FIELDS: Record<DimensionKey, keyof ProposalClassification> = {
  treasuryConservative: 'dimTreasuryConservative',
  treasuryGrowth: 'dimTreasuryGrowth',
  decentralization: 'dimDecentralization',
  security: 'dimSecurity',
  innovation: 'dimInnovation',
  transparency: 'dimTransparency',
};

/**
 * Project a DRep's PCA coordinates into the 6 named governance dimensions.
 *
 * For each dimension d:
 *   score_d = sum_j(coord_j * sum_p(loading_j_p * classification_p_d)) / normalization
 *
 * This computes how much each PCA component "loads" onto each governance
 * dimension (via proposal classifications), then weights by the DRep's
 * coordinate in each component.
 *
 * @param pcaCoordinates DRep's position in PCA space (k values)
 * @param loadings PCA loadings matrix (k components × N proposals)
 * @param proposalIds Ordered proposal IDs matching loadings columns
 * @param classifications Proposal classifications with dimension relevance
 * @returns Dimension scores 0-100, or null if projection fails
 */
export function projectPCAToDimensions(
  pcaCoordinates: number[],
  loadings: number[][],
  proposalIds: string[],
  classifications: ProposalClassification[],
): DimensionScores | null {
  if (pcaCoordinates.length === 0 || loadings.length === 0) return null;

  const classMap = new Map<string, ProposalClassification>();
  for (const c of classifications) {
    classMap.set(`${c.proposalTxHash}-${c.proposalIndex}`, c);
  }

  // For each dimension, compute the DRep's projected score
  const scores: Record<string, number | null> = {};

  for (const dim of DIMENSION_KEYS) {
    const field = CLASSIFICATION_FIELDS[dim];
    let projectedValue = 0;
    let totalRelevance = 0;

    // Sum across PCA components
    for (let c = 0; c < pcaCoordinates.length && c < loadings.length; c++) {
      const componentLoadings = loadings[c];
      let componentDimScore = 0;
      let componentRelevance = 0;

      // For this component, compute its alignment with this dimension
      for (let p = 0; p < proposalIds.length && p < componentLoadings.length; p++) {
        const cls = classMap.get(proposalIds[p]);
        if (!cls) continue;
        const relevance = (cls[field] as number) ?? 0;
        if (relevance <= 0) continue;

        componentDimScore += componentLoadings[p] * relevance;
        componentRelevance += relevance;
      }

      if (componentRelevance > 0) {
        // Weight by DRep's coordinate in this component
        projectedValue += pcaCoordinates[c] * (componentDimScore / componentRelevance);
        totalRelevance += componentRelevance;
      }
    }

    // Normalize to 0-100 using sigmoid-like mapping
    // Raw projected values are unbounded; map to 0-100 centered at 50
    if (totalRelevance > 0) {
      const normalized = sigmoid(projectedValue) * 100;
      scores[dim] = Math.round(Math.max(0, Math.min(100, normalized)));
    } else {
      scores[dim] = null; // no relevant data for this dimension
    }
  }

  return scores as unknown as DimensionScores;
}

/**
 * Reconcile PCA-projected and manual dimension scores.
 *
 * When PCA meets variance threshold: use PCA-projected scores.
 * When PCA is below threshold or unavailable: use manual scores.
 *
 * @param pcaScores PCA-projected dimension scores (null if unavailable)
 * @param manualScores Manual dimension scores (always available)
 * @param pcaMeetsThreshold Whether PCA explained variance meets minimum
 * @returns Reconciled scores and which source was used
 */
export function reconcileDimensionScores(
  pcaScores: DimensionScores | null,
  manualScores: DimensionScores,
  pcaMeetsThreshold: boolean,
): { scores: DimensionScores; source: 'pca' | 'manual' } {
  if (pcaScores && pcaMeetsThreshold) {
    return { scores: pcaScores, source: 'pca' };
  }
  return { scores: manualScores, source: 'manual' };
}

/** Sigmoid function mapping unbounded values to (0, 1), centered at 0.5. */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
