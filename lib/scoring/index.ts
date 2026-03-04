/**
 * Civica Scoring Engine — barrel export.
 * DRep Score V3 + SPO Score V2.
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
} from './types';

// SPO Score V2
export {
  computeSpoScores,
  SPO_PILLAR_WEIGHTS,
  type SpoVoteData,
  type SpoScoreResult,
} from './spoScore';
export { computeSpoGovernanceIdentity, type SpoProfileData } from './spoGovernanceIdentity';

// Score Tiers
export {
  computeTier,
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
