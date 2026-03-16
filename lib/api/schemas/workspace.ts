import { z } from 'zod';

// ---------------------------------------------------------------------------
// Draft CRUD schemas
// ---------------------------------------------------------------------------

const GOVERNANCE_ACTION_TYPES = [
  'InfoAction',
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitution',
] as const;

export const CreateDraftSchema = z.object({
  stakeAddress: z.string().min(1, 'stakeAddress is required'),
  proposalType: z.enum(GOVERNANCE_ACTION_TYPES),
  title: z.string().max(200).optional(),
});

export const UpdateDraftSchema = z.object({
  title: z.string().max(200).optional(),
  abstract: z.string().max(2000).optional(),
  motivation: z.string().max(10000).optional(),
  rationale: z.string().max(10000).optional(),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

export const SaveVersionSchema = z.object({
  versionName: z.string().min(1, 'Version name is required').max(100),
  editSummary: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Constitutional pre-check schema
// ---------------------------------------------------------------------------

export const ConstitutionalCheckSchema = z.object({
  title: z.string().max(200),
  abstract: z.string().max(2000),
  motivation: z.string().max(10000),
  rationale: z.string().max(10000),
  proposalType: z.enum(GOVERNANCE_ACTION_TYPES),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// CIP-108 preview schema
// ---------------------------------------------------------------------------

export const Cip108PreviewSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  abstract: z.string().min(1, 'Abstract is required').max(2000),
  motivation: z.string().min(1, 'Motivation is required').max(10000),
  rationale: z.string().min(1, 'Rationale is required').max(10000),
  proposalType: z.enum(GOVERNANCE_ACTION_TYPES),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
  authorName: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Review queue schema
// ---------------------------------------------------------------------------

export const ReviewQueueParamsSchema = z.object({
  drepId: z.string().optional(),
  poolId: z.string().optional(),
});
