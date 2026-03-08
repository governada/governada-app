/**
 * Runtime validation schemas for Koios API responses.
 * Uses .passthrough() to allow extra fields — we only validate the fields we depend on.
 * z.coerce is used where Koios sometimes returns numbers as strings.
 */
import { z } from 'zod';

export const KoiosDRepListItemSchema = z
  .object({
    drep_id: z.string(),
    drep_hash: z.string(),
    hex: z.string(),
    has_script: z.boolean(),
    registered: z.boolean(),
  })
  .passthrough();

export const KoiosDRepInfoSchema = z
  .object({
    drep_id: z.string(),
    drep_hash: z.string(),
    hex: z.string(),
    has_script: z.boolean(),
    registered: z.boolean(),
    deposit: z.string().nullable(),
    anchor_url: z.string().nullable(),
    anchor_hash: z.string().nullable(),
    amount: z.string(),
    active_epoch: z.number().nullable(),
  })
  .passthrough();

export const KoiosVoteSchema = z
  .object({
    proposal_tx_hash: z.string(),
    proposal_index: z.number(),
    vote_tx_hash: z.string(),
    block_time: z.number(),
    vote: z.enum(['Yes', 'No', 'Abstain']),
    meta_url: z.string().nullable(),
    meta_hash: z.string().nullable(),
  })
  .passthrough();

export const KoiosVoteListSchema = z
  .object({
    vote_tx_hash: z.string(),
    voter_id: z.string(),
    proposal_tx_hash: z.string(),
    proposal_index: z.number(),
    epoch_no: z.number(),
    block_time: z.number(),
    vote: z.enum(['Yes', 'No', 'Abstain']),
    meta_url: z.string().nullable(),
    meta_hash: z.string().nullable(),
  })
  .passthrough();

export const KoiosProposalSchema = z
  .object({
    proposal_tx_hash: z.string(),
    proposal_index: z.number(),
    proposal_id: z.string(),
    proposal_type: z.string(),
    deposit: z.string(),
    return_address: z.string(),
    proposed_epoch: z.number(),
    ratified_epoch: z.number().nullable(),
    enacted_epoch: z.number().nullable(),
    dropped_epoch: z.number().nullable(),
    expired_epoch: z.number().nullable(),
    block_time: z.number(),
  })
  .passthrough();

export const KoiosTreasurySchema = z
  .object({
    epoch_no: z.number(),
    treasury: z.string(),
    reserves: z.string(),
    supply: z.string(),
    reward: z.string(),
    circulation: z.string(),
  })
  .passthrough();

export const KoiosSPOVoteSchema = z
  .object({
    vote_tx_hash: z.string(),
    voter_id: z.string(),
    proposal_tx_hash: z.string(),
    proposal_index: z.number(),
    epoch_no: z.number(),
    block_time: z.number(),
    vote: z.enum(['Yes', 'No', 'Abstain']),
  })
  .passthrough();

export const KoiosCCVoteSchema = z
  .object({
    vote_tx_hash: z.string(),
    voter_id: z.string(),
    proposal_tx_hash: z.string(),
    proposal_index: z.number(),
    epoch_no: z.number(),
    block_time: z.number(),
    vote: z.enum(['Yes', 'No', 'Abstain']),
    meta_url: z.string().nullable(),
    meta_hash: z.string().nullable(),
  })
  .passthrough();

export const KoiosDelegatorSchema = z
  .object({
    stake_address: z.string(),
  })
  .passthrough();

/**
 * Validate an array of Koios records, filtering out malformed ones.
 * Returns { valid, invalid, errors } so callers can log and continue.
 */
export function validateArray<T>(
  data: unknown[],
  schema: z.ZodType<T>,
  label: string,
): { valid: T[]; invalidCount: number; errors: string[] } {
  const valid: T[] = [];
  const errors: string[] = [];
  let invalidCount = 0;

  for (const item of data) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalidCount++;
      if (errors.length < 3) {
        const issues = result.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ');
        errors.push(`${label} validation: ${issues}`);
      }
    }
  }

  if (invalidCount > 0) {
    console.warn(`[Koios] ${label}: ${invalidCount}/${data.length} records failed validation`);
  }

  return { valid, invalidCount, errors };
}
