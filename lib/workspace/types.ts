/**
 * Shared types for the Proposal Review Workspace and Authoring Pipeline.
 *
 * Used by both `/workspace/review` (DRep/SPO review) and `/workspace/author`
 * (proposal team authoring) routes and their supporting APIs.
 */

// ---------------------------------------------------------------------------
// Governance action types (shared)
// ---------------------------------------------------------------------------

export type ProposalType =
  | 'InfoAction'
  | 'TreasuryWithdrawals'
  | 'ParameterChange'
  | 'HardForkInitiation'
  | 'NoConfidence'
  | 'NewCommittee'
  | 'NewConstitution';

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  InfoAction: 'Info Action',
  TreasuryWithdrawals: 'Treasury Withdrawal',
  ParameterChange: 'Parameter Change',
  HardForkInitiation: 'Hard Fork Initiation',
  NoConfidence: 'No Confidence',
  NewCommittee: 'New Committee',
  NewConstitution: 'New Constitution',
};

export const PROPOSAL_TYPE_DESCRIPTIONS: Record<ProposalType, string> = {
  InfoAction: 'A non-binding informational action for community signaling.',
  TreasuryWithdrawals: 'Request ADA from the Cardano treasury for a specific purpose.',
  ParameterChange: 'Propose a change to one or more protocol parameters.',
  HardForkInitiation: 'Initiate a hard fork to upgrade the protocol.',
  NoConfidence: 'Express no confidence in the current Constitutional Committee.',
  NewCommittee: 'Propose new members for the Constitutional Committee.',
  NewConstitution: 'Propose a replacement for the Cardano Constitution.',
};

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
  /** When the independent assessment period ends (sealed positions). */
  sealedUntil: string | null;
  /** Full proposal metadata from CIP-108 meta_json */
  motivation: string | null;
  rationale: string | null;
  references: Array<{ type: string; label: string; uri: string }> | null;
}

/** Reference link from proposal metadata */
export interface ProposalReference {
  type: string;
  label: string;
  uri: string;
}

/** Annotation types */
export type AnnotationType = 'note' | 'highlight' | 'citation' | 'concern';
export type AnnotationField = 'abstract' | 'motivation' | 'rationale';

/** Engagement event types */
export type EngagementEventType = 'view' | 'section_read' | 'annotation_created';

/** Annotation on proposal text */
export interface ProposalAnnotation {
  id: string;
  userId: string;
  proposalTxHash: string;
  proposalIndex: number;
  anchorStart: number;
  anchorEnd: number;
  anchorField: AnnotationField;
  annotationText: string;
  annotationType: AnnotationType;
  color: string | null;
  isPublic: boolean;
  upvoteCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Engagement event */
export interface ProposalEngagementEvent {
  id: number;
  proposalTxHash: string;
  proposalIndex: number;
  eventType: EngagementEventType;
  section: string | null;
  durationSeconds: number | null;
  userSegment: string | null;
  userId: string | null;
  createdAt: string;
}

/** Review framework template checklist item */
export interface ReviewChecklistItem {
  question: string;
  category: string;
  weight: number;
}

/** Review framework template */
export interface ReviewFrameworkTemplate {
  id: string;
  proposalType: string;
  name: string;
  description: string | null;
  checklist: ReviewChecklistItem[];
  isDefault: boolean;
}

/** Treasury impact context for treasury withdrawal proposals */
export interface TreasuryImpact {
  currentBalanceAda: number;
  withdrawalAda: number;
  withdrawalPercent: number;
  nclUtilizationCurrent: number;
  nclUtilizationIfApproved: number;
  pendingWithdrawalsAda: number;
  runwayMonthsCurrent: number;
  runwayMonthsIfApproved: number;
}

/** Review time budget */
export interface TimeBudgetEstimate {
  totalProposals: number;
  estimatedMinutes: number;
  avgMinutesPerProposal: number;
  highPriorityCount: number;
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

export type DraftStatus =
  | 'draft'
  | 'community_review'
  | 'response_revision'
  | 'final_comment'
  | 'submitted'
  | 'archived';

export interface DraftContent {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  proposalType: ProposalType;
  /** Type-specific fields (e.g., withdrawal amount for treasury) */
  typeSpecific?: Record<string, unknown>;
}

export interface ProposalDraft {
  id: string;
  ownerStakeAddress: string;
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  proposalType: ProposalType;
  typeSpecific: Record<string, unknown> | null;
  status: DraftStatus;
  currentVersion: number;
  stageEnteredAt: string | null;
  communityReviewStartedAt: string | null;
  fcpStartedAt: string | null;
  submittedTxHash: string | null;
  submittedAnchorUrl: string | null;
  submittedAnchorHash: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersion {
  id: string;
  draftId: string;
  versionNumber: number;
  versionName: string;
  editSummary: string | null;
  content: DraftContent;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constitutional Pre-Check types
// ---------------------------------------------------------------------------

export type CheckSeverity = 'info' | 'warning' | 'critical';
export type CheckScore = 'pass' | 'warning' | 'fail';

export interface ConstitutionalFlag {
  article: string;
  section?: string;
  concern: string;
  severity: CheckSeverity;
}

export interface ConstitutionalCheckResult {
  flags: ConstitutionalFlag[];
  score: CheckScore;
  checkedAt: string;
  model: string;
}

// ---------------------------------------------------------------------------
// CIP-108 types
// ---------------------------------------------------------------------------

export interface Cip108Body {
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  references?: Array<{
    '@type': string;
    label: string;
    uri: string;
  }>;
}

export interface Cip108Document {
  '@context': Record<string, unknown>;
  hashAlgorithm: string;
  body: Cip108Body;
  authors?: Array<{ name?: string }>;
}

// ---------------------------------------------------------------------------
// Proposal Notes (per-proposal private notes)
// ---------------------------------------------------------------------------

export interface ProposalNote {
  id: string;
  userId: string;
  proposalTxHash: string;
  proposalIndex: number;
  noteText: string;
  highlights: Array<{ start: number; end: number; color?: string; comment?: string }>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Decision Journal
// ---------------------------------------------------------------------------

export type JournalPosition =
  | 'undecided'
  | 'lean_yes'
  | 'lean_no'
  | 'lean_abstain'
  | 'yes'
  | 'no'
  | 'abstain';

export interface DecisionJournalEntry {
  id: string;
  userId: string;
  proposalTxHash: string;
  proposalIndex: number;
  position: JournalPosition;
  confidence: number;
  steelmanText: string;
  keyAssumptions: string;
  whatWouldChangeMind: string;
  positionHistory: Array<{ position: JournalPosition; timestamp: string; reason?: string }>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Draft Reviews (structured community feedback)
// ---------------------------------------------------------------------------

export interface DraftReview {
  id: string;
  draftId: string;
  reviewerStakeAddress: string;
  impactScore: number | null;
  feasibilityScore: number | null;
  constitutionalScore: number | null;
  valueScore: number | null;
  feedbackText: string;
  feedbackThemes: string[];
  createdAt: string;
}

export interface DraftReviewResponse {
  id: string;
  reviewId: string;
  responseType: 'accept' | 'decline' | 'modify';
  responseText: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Perspective Clusters
// ---------------------------------------------------------------------------

export interface PerspectiveCluster {
  label: string;
  summary: string;
  size: number;
  representativeQuotes: string[];
  isMinority: boolean;
}

export interface PerspectiveClustersData {
  proposalTxHash: string;
  proposalIndex: number;
  clusters: PerspectiveCluster[];
  minorityPerspectives: PerspectiveCluster[];
  bridgingPoints: string[];
  rationaleCount: number;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Skill Invocation (provenance)
// ---------------------------------------------------------------------------

export interface SkillInvocationLog {
  id: string;
  userId: string | null;
  stakeAddress: string | null;
  skillName: string;
  proposalTxHash: string | null;
  proposalIndex: number | null;
  draftId: string | null;
  modelUsed: string;
  tokensUsed: number | null;
  keySource: 'platform' | 'byok';
  editDistance: number | null;
  inputSummary: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// BYOK Key (for display, never includes the actual key)
// ---------------------------------------------------------------------------

export interface BYOKKeyInfo {
  id: string;
  provider: string;
  keyPrefix: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Version Diff types
// ---------------------------------------------------------------------------

export interface DiffResult {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

export interface StructuredDiff {
  title: DiffResult[];
  abstract: DiffResult[];
  motivation: DiffResult[];
  rationale: DiffResult[];
  fieldsChanged: string[];
}

// ---------------------------------------------------------------------------
// Research Assistant types
// ---------------------------------------------------------------------------

export interface ResearchMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: Array<{ type: string; reference: string; text: string }>;
}

export interface ResearchConversation {
  id: string;
  proposalTxHash: string;
  proposalIndex: number;
  messages: ResearchMessage[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Governance Action Submission types
// ---------------------------------------------------------------------------

export interface GovernanceActionTarget {
  type: ProposalType;
  anchorUrl: string;
  anchorHash: string;
  /** For TreasuryWithdrawals: amount in lovelace */
  withdrawalAmount?: number;
  /** For TreasuryWithdrawals: receiving address */
  receivingAddress?: string;
}

export interface GovernanceActionPreflight {
  estimatedDeposit: string;
  estimatedFee: string;
  currentBalance: string;
  balanceAfter: string;
  canAfford: boolean;
  /** Deposit in lovelace for programmatic use */
  depositLovelace: string;
}

export interface GovernanceActionResult {
  txHash: string;
  anchorUrl: string;
  anchorHash: string;
}

// ---------------------------------------------------------------------------
// Proposal Teams (multi-user collaboration)
// ---------------------------------------------------------------------------

export type TeamRole = 'lead' | 'editor' | 'viewer';

export interface ProposalTeam {
  id: string;
  draftId: string;
  name: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string | null;
  stakeAddress: string;
  role: TeamRole;
  invitedAt: string;
  joinedAt: string | null;
}

export interface TeamInvite {
  id: string;
  teamId: string;
  inviteCode: string;
  role: TeamRole;
  expiresAt: string;
  maxUses: number;
  useCount: number;
  createdBy: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Proposal Health Score
// ---------------------------------------------------------------------------

export interface ProposalHealthCheck {
  label: string;
  passed: boolean;
  weight: number;
}

export interface ProposalHealthResult {
  score: number;
  checks: ProposalHealthCheck[];
}

// ---------------------------------------------------------------------------
// Proposer Track Record
// ---------------------------------------------------------------------------

export interface ProposerTrackRecord {
  totalProposals: number;
  ratifiedCount: number;
  expiredCount: number;
  droppedCount: number;
  deliveredCount: number;
  partialCount: number;
  notDeliveredCount: number;
  avgCommunityScore: number | null;
}

// ---------------------------------------------------------------------------
// Proposal Engagement Analytics
// ---------------------------------------------------------------------------

export interface ProposalEngagementAnalytics {
  totalViews: number;
  uniqueViewers: number;
  avgTimeSpentSec: number;
  sectionDistribution: {
    section: string;
    viewCount: number;
  }[];
  viewerSegments: {
    segment: string;
    count: number;
  }[];
}

// ---------------------------------------------------------------------------
// Score Impact Preview
// ---------------------------------------------------------------------------

export interface ScoreImpactEstimate {
  currentParticipationRate: number;
  projectedParticipationRate: number;
  participationDelta: number;
  rationaleBoost: number;
  estimatedScoreGain: number;
}
