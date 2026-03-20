/**
 * Ambient AI Annotations — barrel export.
 *
 * All annotations follow the Harvey AI/Elicit provenance pattern:
 * source data -> AI reasoning -> conclusion, with expandable chains.
 *
 * Feature-flagged behind `ambient_annotations`.
 */

export { AnnotationBase } from './AnnotationBase';
export type { ProvenanceStep } from './AnnotationBase';

export { ConstitutionalRisk, assessConstitutionalRisk } from './ConstitutionalRisk';
export type { ConstitutionalRiskData, RiskLevel } from './ConstitutionalRisk';

export { AlignmentDrift, computeAlignmentDrift } from './AlignmentDrift';
export type { AlignmentDriftData } from './AlignmentDrift';

export { ScoreExplainer, generateScoreExplanation } from './ScoreExplainer';
export type { ScoreExplanation, ScoreFactor } from './ScoreExplainer';

export { RelevanceBadge } from './RelevanceBadge';
export type { RelevanceData } from './RelevanceBadge';
