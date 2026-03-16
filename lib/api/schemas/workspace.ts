import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const ProposalTypeEnum = z.enum([
  'InfoAction',
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitution',
]);

// ---------------------------------------------------------------------------
// Draft CRUD schemas (authoring pipeline)
// ---------------------------------------------------------------------------

export const CreateDraftSchema = z.object({
  stakeAddress: z.string().min(1, 'stakeAddress is required'),
  title: z.string().max(200).default(''),
  abstract: z.string().max(2000).default(''),
  motivation: z.string().max(10000).default(''),
  rationale: z.string().max(10000).default(''),
  proposalType: ProposalTypeEnum,
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateDraftSchema = z.object({
  title: z.string().max(200).optional(),
  abstract: z.string().max(2000).optional(),
  motivation: z.string().max(10000).optional(),
  rationale: z.string().max(10000).optional(),
  proposalType: ProposalTypeEnum.optional(),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
  status: z
    .enum([
      'draft',
      'community_review',
      'response_revision',
      'final_comment',
      'submitted',
      'archived',
    ])
    .optional(),
});

export const SaveVersionSchema = z.object({
  versionName: z.string().min(1, 'versionName is required').max(200),
  editSummary: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Constitutional pre-check schema
// ---------------------------------------------------------------------------

export const ConstitutionalCheckSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  abstract: z.string().max(2000).default(''),
  motivation: z.string().max(10000).default(''),
  rationale: z.string().max(10000).default(''),
  proposalType: ProposalTypeEnum,
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// CIP-108 preview schema
// ---------------------------------------------------------------------------

export const Cip108PreviewSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  abstract: z.string().max(2000).default(''),
  motivation: z.string().max(10000).default(''),
  rationale: z.string().max(10000).default(''),
  authorName: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Review queue schema
// ---------------------------------------------------------------------------

export const ReviewQueueParamsSchema = z.object({
  drepId: z.string().optional(),
  poolId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Proposal notes schemas
// ---------------------------------------------------------------------------

export const SaveNoteSchema = z.object({
  proposalTxHash: z.string().min(1),
  proposalIndex: z.coerce.number().int().min(0),
  noteText: z.string().max(50000),
  highlights: z
    .array(
      z.object({
        start: z.number(),
        end: z.number(),
        color: z.string().optional(),
        comment: z.string().max(500).optional(),
      }),
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// Decision journal schemas
// ---------------------------------------------------------------------------

const JournalPositionEnum = z.enum([
  'undecided',
  'lean_yes',
  'lean_no',
  'lean_abstain',
  'yes',
  'no',
  'abstain',
]);

export const SaveJournalSchema = z.object({
  proposalTxHash: z.string().min(1),
  proposalIndex: z.coerce.number().int().min(0),
  position: JournalPositionEnum,
  confidence: z.number().int().min(0).max(100),
  steelmanText: z.string().max(5000).optional(),
  keyAssumptions: z.string().max(5000).optional(),
  whatWouldChangeMind: z.string().max(5000).optional(),
});

// ---------------------------------------------------------------------------
// Draft review schemas (structured community feedback)
// ---------------------------------------------------------------------------

export const SubmitReviewSchema = z.object({
  reviewerStakeAddress: z.string().min(1),
  impactScore: z.number().int().min(1).max(5).optional(),
  feasibilityScore: z.number().int().min(1).max(5).optional(),
  constitutionalScore: z.number().int().min(1).max(5).optional(),
  valueScore: z.number().int().min(1).max(5).optional(),
  feedbackText: z.string().min(1).max(10000),
  feedbackThemes: z.array(z.string().max(100)).max(10).optional(),
});

export const RespondToReviewSchema = z.object({
  responseType: z.enum(['accept', 'decline', 'modify']),
  responseText: z.string().min(1).max(5000),
});

// ---------------------------------------------------------------------------
// Stage transition schema
// ---------------------------------------------------------------------------

export const StageTransitionSchema = z.object({
  targetStage: z.enum([
    'draft',
    'community_review',
    'response_revision',
    'final_comment',
    'submitted',
    'archived',
  ]),
});

// ---------------------------------------------------------------------------
// Contribution uniqueness check schema
// ---------------------------------------------------------------------------

export const ContributionCheckSchema = z.object({
  proposalTxHash: z.string().min(1),
  proposalIndex: z.coerce.number().int().min(0),
  text: z.string().min(10).max(10000),
});

// ---------------------------------------------------------------------------
// BYOK API key schemas
// ---------------------------------------------------------------------------

export const AddApiKeySchema = z.object({
  provider: z.enum(['anthropic', 'openai']),
  apiKey: z.string().min(10, 'API key is too short').max(200),
});

// ---------------------------------------------------------------------------
// Skill invocation schema
// ---------------------------------------------------------------------------

export const SkillInvocationSchema = z.object({
  skill: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  proposalTxHash: z.string().optional(),
  proposalIndex: z.number().optional(),
  draftId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Proposal team schemas (multi-user collaboration)
// ---------------------------------------------------------------------------

export const CreateTeamSchema = z.object({
  draftId: z.string().uuid(),
  name: z.string().max(200).optional(),
});

export const InviteMemberSchema = z.object({
  teamId: z.string().uuid(),
  role: z.enum(['editor', 'viewer']),
  expiresInHours: z.number().int().min(1).max(168).default(72), // max 1 week
  maxUses: z.number().int().min(1).max(10).default(1),
});

export const JoinTeamSchema = z.object({
  inviteCode: z.string().min(1),
});

export const UpdateMemberRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(['editor', 'viewer']),
});

export const RemoveMemberSchema = z.object({
  memberId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Proposal annotation schemas (inline text annotations)
// ---------------------------------------------------------------------------

export const CreateAnnotationSchema = z.object({
  proposalTxHash: z.string().min(1),
  proposalIndex: z.coerce.number().int().min(0),
  anchorStart: z.number().int().min(0),
  anchorEnd: z.number().int().min(0),
  anchorField: z.enum(['abstract', 'motivation', 'rationale']),
  annotationText: z.string().min(1).max(2000),
  annotationType: z.enum(['note', 'highlight', 'citation', 'concern']),
  color: z.string().max(20).optional(),
  isPublic: z.boolean().optional(),
});

export const UpdateAnnotationSchema = z.object({
  id: z.string().uuid(),
  annotationText: z.string().min(1).max(2000).optional(),
  isPublic: z.boolean().optional(),
  color: z.string().max(20).optional(),
});

// ---------------------------------------------------------------------------
// Engagement tracking schemas
// ---------------------------------------------------------------------------

export const TrackEngagementSchema = z.object({
  proposalTxHash: z.string().min(1),
  proposalIndex: z.coerce.number().int().min(0),
  eventType: z.enum(['view', 'section_read', 'annotation_created']),
  section: z.string().max(50).optional(),
  durationSeconds: z.number().int().min(0).max(3600).optional(),
  userSegment: z.string().max(50).optional(),
});
