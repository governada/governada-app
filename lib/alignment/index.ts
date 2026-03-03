/**
 * PCA Alignment System — barrel export.
 */

export { classifyProposalsAI, type ProposalClassification } from './classifyProposals';
export {
  buildVoteMatrix,
  imputeMatrix,
  type VoteMatrixInput,
  type VoteMatrixResult,
} from './voteMatrix';
export {
  computeDimensionScores,
  type DimensionInput,
  type DRepContext,
  type DimensionScores,
} from './dimensions';
export { scoreRationalesBatch } from './rationaleQuality';
export { normalizeToPercentiles, type RawScoreRow, type NormalizedScoreRow } from './normalize';
export { computePCA, storePCAResults, loadActivePCA, type PCAResult } from './pca';
export { validateDimensionIndependence, type ValidationReport } from './validate';
