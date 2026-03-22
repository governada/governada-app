/**
 * Governada Scoring Engine — barrel export.
 * DRep Score V3 + SPO Score V3.
 */

export { computeEngagementQuality } from './engagementQuality';
export {
  computeEffectiveParticipation,
  getExtendedImportanceWeight,
} from './effectiveParticipation';
export { computeReliability, type ReliabilityV3Result } from './reliability';
export { computeGovernanceIdentity } from './governanceIdentity';
export { computeDRepScores } from './drepScore';
export { percentileNormalize } from './percentile';
export {
  PILLAR_WEIGHTS,
  DECAY_LAMBDA,
  DECAY_HALF_LIFE_DAYS,
  type VoteData,
  type ProposalScoringContext,
  type ProposalVotingSummary,
  type DRepProfileData,
  type DRepScoreResult,
  type DelegationSnapshotData,
} from './types';

// SPO Score V3
export {
  computeSpoScores,
  computeProposalMarginMultipliers,
  SPO_PILLAR_WEIGHTS,
  type SpoVoteData,
  type SpoVoteDataV3,
  type SpoScoreResult,
} from './spoScore';
export {
  computeSpoGovernanceIdentity,
  type SpoProfileData,
  type DelegationRetentionData,
} from './spoGovernanceIdentity';
export {
  computeSpoDeliberationQuality,
  type SpoDeliberationVoteData,
} from './spoDeliberationQuality';
export {
  computeConfidence,
  computeDRepConfidence,
  getDRepTierCap,
  getDRepConfidenceByVotes,
  getSpoTierCap,
  getSpoConfidenceByVotes,
  dampenPercentile,
  percentileNormalizeWeighted,
} from './confidence';
export {
  computeSybilConfidencePenalty,
  applySybilPenalty,
  type SybilConfidenceFlag,
} from './sybilPenalty';
export {
  computeParticipationAttribution,
  generateRecommendations,
  type SpoAttribution,
  type PillarAttribution,
  type AttributionEntry,
} from './spoAttribution';
export { detectSybilPairs, type SybilFlag } from './sybilDetection';
export {
  cosineSimilarity,
  computeSemanticDiversityScore,
  computeSemanticDiversityMap,
} from './semanticDiversity';

// Score Tiers
export {
  computeTier,
  computeTierWithCap,
  computeTierProgress,
  detectTierChange,
  getTierInfo,
  tierIndex,
  TIERS,
  type TierName,
  type TierInfo,
  type TierProgress,
  type TierChange,
} from './tiers';
