/**
 * Shared types for the Proposal Review Workspace and Authoring Pipeline.
 *
 * Used by both `/workspace/review` (DRep/SPO review) and `/workspace/author`
 * (proposal team authoring) routes and their supporting APIs.
 */

// ---------------------------------------------------------------------------
// Review Workspace types
// ---------------------------------------------------------------------------

export type QueueStatus = 'unreviewed' | 'reviewing' | 'voted' | 'snoozed';

export interface ReviewQueueItem {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  epochsRemaining: number | null;
  isUrgent: boolean;
  aiSummary: string | null;
  abstract: string | null;
  status: QueueStatus;
  /** Existing DRep/SPO vote on this proposal (null if not yet voted) */
  existingVote: 'Yes' | 'No' | 'Abstain' | null;
  // Intelligence overlays
  drepVoteTally: { yes: number; no: number; abstain: number };
  spoVoteTally: { yes: number; no: number; abstain: number };
  ccVoteTally: { yes: number; no: number; abstain: number };
  citizenSentiment: { support: number; oppose: number; total: number } | null;
  constitutionalFlags: number;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
}

// ---------------------------------------------------------------------------
// Authoring Pipeline types
// ---------------------------------------------------------------------------

export type DraftStatus = 'draft' | 'community_review' | 'final_comment' | 'submitted' | 'archived';

export type GovernanceActionType =
  | 'InfoAction'
  | 'TreasuryWithdrawals'
  | 'ParameterChange'
  | 'HardForkInitiation'
  | 'NoConfidence'
  | 'NewCommittee'
  | 'NewConstitution';

export interface ProposalDraft {
  id: string;
  ownerStakeAddress: string;
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  proposalType: GovernanceActionType;
  typeSpecific: Record<string, unknown>;
  status: DraftStatus;
  currentVersion: number;
  lastConstitutionalCheck: ConstitutionalCheckResult | null;
  lastConstitutionalCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersion {
  id: string;
  draftId: string;
  versionNumber: number;
  versionName: string;
  editSummary: string;
  content: DraftContent;
  constitutionalCheck: ConstitutionalCheckResult | null;
  createdAt: string;
}

export interface DraftContent {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  typeSpecific: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constitutional Pre-Check types
// ---------------------------------------------------------------------------

export interface ConstitutionalCheckResult {
  flags: ConstitutionalFlag[];
  score: 'pass' | 'warning' | 'fail';
  checkedAt: string;
  model: string;
}

export interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: 'info' | 'warning' | 'critical';
}

// ---------------------------------------------------------------------------
// CIP-108 types
// ---------------------------------------------------------------------------

export interface Cip108Document {
  '@context': Record<string, unknown>;
  hashAlgorithm: string;
  body: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
    references?: Array<{
      '@type': string;
      label: string;
      uri: string;
    }>;
  };
  authors?: Array<{
    name?: string;
  }>;
}
