/**
 * Shared types for the DRep Score V3 scoring pipeline.
 * All pillar modules consume these; the Inngest sync function constructs them.
 */

import { TEMPORAL_DECAY, DREP_PILLAR_WEIGHTS } from './calibration';

// Re-export from calibration config for backward compatibility
export const DECAY_HALF_LIFE_DAYS = TEMPORAL_DECAY.halfLifeDays;
export const DECAY_LAMBDA = TEMPORAL_DECAY.lambda;
export const PILLAR_WEIGHTS = DREP_PILLAR_WEIGHTS;

export interface VoteData {
  drepId: string;
  proposalKey: string; // `${tx_hash}-${index}`
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number; // unix seconds
  proposalBlockTime: number; // unix seconds
  proposalType: string;
  rationaleQuality: number | null;
  importanceWeight: number;
  /** CIP-100 metadata hash — unique per rationale document. Used for diversity detection. */
  rationaleMetaHash: string | null;
  /** True if this vote replaced a previous vote on the same proposal (adaptive governance). */
  hasVoteChanged: boolean;
}

export interface ProposalScoringContext {
  proposalKey: string;
  proposalType: string;
  treasuryTier: string | null;
  withdrawalAmount: number | null;
  blockTime: number;
  importanceWeight: number;
}

export interface ProposalVotingSummary {
  proposalKey: string;
  drepYesVotePower: number;
  drepNoVotePower: number;
  drepAbstainVotePower: number;
}

export interface DRepProfileData {
  drepId: string;
  metadata: Record<string, unknown> | null;
  delegatorCount: number;
  metadataHashVerified: boolean;
  brokenUris?: Set<string>;
  /** Unix seconds when the profile was last updated on-chain, or null if unknown. */
  updatedAt: number | null;
  /** Unix seconds when profile_metadata_hash last changed, or null if not yet tracked. */
  profileLastChangedAt: number | null;
}

/**
 * Delegation snapshot data for a single DRep across epochs.
 * Used to compute delegation health signals (retention, diversity, growth).
 */
export interface DelegationSnapshotData {
  /** Delegator counts per epoch, ordered by epoch ascending. */
  epochs: {
    epoch: number;
    delegatorCount: number;
    totalPowerLovelace: number;
    newDelegators: number | null;
    lostDelegators: number | null;
  }[];
}

export interface DRepScoreResult {
  composite: number;
  engagementQualityRaw: number;
  engagementQualityCalibrated: number;
  effectiveParticipationRaw: number;
  effectiveParticipationCalibrated: number;
  reliabilityRaw: number;
  reliabilityCalibrated: number;
  governanceIdentityRaw: number;
  governanceIdentityCalibrated: number;
  confidence: number;
  momentum: number | null;
}
