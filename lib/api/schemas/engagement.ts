import { z } from 'zod';
import { TxHashSchema, ProposalIndexSchema } from './common';

// -- Sentiment --

export const SentimentVoteSchema = z.object({
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  sentiment: z.enum(['support', 'oppose', 'unsure']),
  stakeAddress: z.string().optional(),
  delegatedDrepId: z.string().optional(),
});

// -- Concern Flags --

export const CONCERN_FLAG_TYPES = [
  'too_expensive',
  'team_unproven',
  'duplicates_existing',
  'constitutional_concern',
  'insufficient_detail',
  'unrealistic_timeline',
  'conflict_of_interest',
  'scope_too_broad',
] as const;

export type ConcernFlagType = (typeof CONCERN_FLAG_TYPES)[number];

export const ConcernFlagSchema = z.object({
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  flagType: z.enum(CONCERN_FLAG_TYPES),
  stakeAddress: z.string().optional(),
});

export const ConcernFlagRemoveSchema = z.object({
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  flagType: z.enum(CONCERN_FLAG_TYPES),
});

// -- Impact Tags --

export const ImpactTagSchema = z.object({
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  awareness: z.enum(['i_use_this', 'i_tried_it', 'didnt_know_about_it']),
  rating: z.enum(['essential', 'useful', 'okay', 'disappointing']),
  comment: z.string().max(500).optional(),
  stakeAddress: z.string().optional(),
});

// -- Priority Signals --

export const PRIORITY_AREAS = [
  'infrastructure',
  'education',
  'defi',
  'marketing',
  'developer_tooling',
  'governance_tooling',
  'identity_dids',
  'interoperability',
  'security_auditing',
  'community_hubs',
  'research',
  'media_content',
] as const;

export type PriorityArea = (typeof PRIORITY_AREAS)[number];

export const PrioritySignalSchema = z.object({
  rankedPriorities: z
    .array(z.enum(PRIORITY_AREAS))
    .min(1)
    .max(5)
    .refine((arr) => new Set(arr).size === arr.length, 'Priorities must be unique'),
  epoch: z.number().int().positive(),
  stakeAddress: z.string().optional(),
});

// -- Assembly Responses --

export const AssemblyVoteSchema = z.object({
  assemblyId: z.string().uuid(),
  selectedOption: z.string().min(1),
  stakeAddress: z.string().optional(),
});

// -- Endorsements --

export const ENDORSEMENT_TYPES = [
  'general',
  'treasury_oversight',
  'technical_expertise',
  'communication',
  'community_leadership',
] as const;

export type EndorsementType = (typeof ENDORSEMENT_TYPES)[number];

export const EndorsementToggleSchema = z.object({
  entityType: z.enum(['drep', 'spo']),
  entityId: z.string().min(1),
  endorsementType: z.enum(ENDORSEMENT_TYPES),
  stakeAddress: z.string().optional(),
});
