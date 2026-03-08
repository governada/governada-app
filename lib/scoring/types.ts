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
}

export interface DRepScoreResult {
  composite: number;
  engagementQualityRaw: number;
  engagementQualityPercentile: number;
  effectiveParticipationRaw: number;
  effectiveParticipationPercentile: number;
  reliabilityRaw: number;
  reliabilityPercentile: number;
  governanceIdentityRaw: number;
  governanceIdentityPercentile: number;
  confidence: number;
  momentum: number | null;
}
