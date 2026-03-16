/**
 * Shared types for the Proposal Review Workspace and Authoring Pipeline.
 *
 * Used by both `/workspace/review` (DRep/SPO review) and `/workspace/author`
 * (proposal team authoring) routes and their supporting APIs.
 */

// ---------------------------------------------------------------------------
// Review Workspace types
// ---------------------------------------------------------------------------

/** Status of a proposal in the user's local review queue. */
export type QueueItemStatus = 'unreviewed' | 'voted' | 'snoozed';

/** Vote tally for a single governance body. */
export interface BodyTally {
  yes: number;
  no: number;
  abstain: number;
}

/** Citizen sentiment summary for a proposal. */
export interface CitizenSentiment {
  support: number;
  oppose: number;
  abstain: number;
  total: number;
}

/** Inter-body vote tallies (DRep, SPO, CC). */
export interface InterBodyVotes {
  drep: BodyTally;
  spo: BodyTally;
  cc: BodyTally;
}

/** A single item in the review queue. */
export interface ReviewQueueItem {
  txHash: string;
  proposalIndex: number;
  title: string;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  epochsRemaining: number | null;
  isUrgent: boolean;
  interBodyVotes: InterBodyVotes;
  citizenSentiment: CitizenSentiment | null;
  /** Whether the current voter has already voted on this proposal. */
  existingVote: string | null;
}

/** Full response from the review-queue API. */
export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  currentEpoch: number;
  totalOpen: number;
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
