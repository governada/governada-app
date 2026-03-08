import { z } from 'zod';
import { DrepIdSchema, SessionTokenSchema, TxHashSchema, ProposalIndexSchema } from './common';

export const ProposalExplainSchema = z.object({
  txHash: TxHashSchema,
  index: ProposalIndexSchema,
});

export const RationaleDraftSchema = z.object({
  drepId: DrepIdSchema,
  voterRole: z.enum(['drep', 'spo']).optional().default('drep'),
  proposalTitle: z.string().min(1, 'proposalTitle is required').max(500),
  proposalAbstract: z.string().max(5000).optional(),
  proposalType: z.string().max(200).optional(),
  aiSummary: z.string().max(5000).optional(),
});

export const RationaleSubmitSchema = z.object({
  drepId: DrepIdSchema,
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  rationaleText: z.string().min(1, 'Rationale text is required').max(10000),
});

export const PollVoteSchema = z.object({
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  vote: z.enum(['yes', 'no', 'abstain']),
  stakeAddress: z.string().optional(),
  delegatedDrepId: z.string().optional(),
});

export const QuestionSchema = z.object({
  sessionToken: SessionTokenSchema,
  drepId: DrepIdSchema,
  questionText: z.string().min(1, 'questionText is required').max(500),
  proposalTxHash: TxHashSchema.optional(),
  proposalIndex: ProposalIndexSchema.optional(),
});

export const QuestionRespondSchema = z.object({
  sessionToken: SessionTokenSchema,
  responseText: z.string().min(1, 'responseText is required').max(2000),
});

export const ViewSchema = z.object({
  drepId: DrepIdSchema,
  sessionToken: z.string().optional(),
});
