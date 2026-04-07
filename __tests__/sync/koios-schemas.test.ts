import { describe, it, expect } from 'vitest';
import {
  KoiosDRepListItemSchema,
  KoiosProposalSchema,
  KoiosVoteListSchema,
  KoiosTreasurySchema,
  validateArray,
} from '@/utils/koios-schemas';

describe('Koios Schema Validation', () => {
  describe('KoiosDRepListItemSchema', () => {
    it('accepts valid DRep list item', () => {
      const result = KoiosDRepListItemSchema.safeParse({
        drep_id: 'drep1abc',
        drep_hash: 'abc123',
        hex: 'abc',
        has_script: false,
        registered: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects item missing drep_id', () => {
      const result = KoiosDRepListItemSchema.safeParse({
        drep_hash: 'abc123',
        hex: 'abc',
        has_script: false,
        registered: true,
      });
      expect(result.success).toBe(false);
    });

    it('allows extra fields via passthrough', () => {
      const result = KoiosDRepListItemSchema.safeParse({
        drep_id: 'drep1abc',
        drep_hash: 'abc123',
        hex: 'abc',
        has_script: false,
        registered: true,
        extra_field: 'allowed',
      });
      expect(result.success).toBe(true);
      expect((result as any).data.extra_field).toBe('allowed');
    });
  });

  describe('KoiosProposalSchema', () => {
    const validProposal = {
      proposal_tx_hash: 'tx123',
      proposal_index: 0,
      proposal_id: 'gov_action1abc',
      proposal_type: 'InfoAction',
      deposit: '100000',
      return_address: 'addr1',
      proposed_epoch: 100,
      ratified_epoch: null,
      enacted_epoch: null,
      dropped_epoch: null,
      expired_epoch: null,
      block_time: 1700000000,
    };

    it('accepts valid proposal', () => {
      expect(KoiosProposalSchema.safeParse(validProposal).success).toBe(true);
    });

    it('rejects proposal missing proposal_tx_hash', () => {
      const { proposal_tx_hash, ...rest } = validProposal;
      expect(KoiosProposalSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects proposal with wrong type for block_time', () => {
      expect(
        KoiosProposalSchema.safeParse({ ...validProposal, block_time: 'not-a-number' }).success,
      ).toBe(false);
    });
  });

  describe('KoiosVoteListSchema', () => {
    const validVote = {
      vote_tx_hash: 'vtx1',
      drep_id: 'drep1',
      proposal_tx_hash: 'tx1',
      proposal_index: 0,
      epoch_no: 100,
      block_time: 1700000000,
      vote: 'Yes',
      meta_url: null,
      meta_hash: null,
      has_rationale: false,
    };

    it('accepts valid vote', () => {
      expect(KoiosVoteListSchema.safeParse(validVote).success).toBe(true);
    });

    it('rejects vote with invalid vote enum', () => {
      expect(KoiosVoteListSchema.safeParse({ ...validVote, vote: 'Maybe' }).success).toBe(false);
    });
  });

  describe('KoiosTreasurySchema', () => {
    it('accepts valid treasury data', () => {
      const result = KoiosTreasurySchema.safeParse({
        epoch_no: 100,
        treasury: '12345',
        reserves: '67890',
        supply: '99999',
        reward: '111',
        circulation: '88888',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('validateArray', () => {
    it('filters out invalid records and returns valid ones', () => {
      const data = [
        { drep_id: 'a', drep_hash: 'h1', hex: 'x', has_script: false, registered: true },
        { drep_hash: 'h2', hex: 'x', has_script: false, registered: true }, // missing drep_id
        { drep_id: 'c', drep_hash: 'h3', hex: 'x', has_script: false, registered: true },
      ];

      const { valid, invalidCount, errors } = validateArray(data, KoiosDRepListItemSchema, 'test');
      expect(valid).toHaveLength(2);
      expect(invalidCount).toBe(1);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns all records when all are valid', () => {
      const data = [
        { drep_id: 'a', drep_hash: 'h1', hex: 'x', has_script: false, registered: true },
        { drep_id: 'b', drep_hash: 'h2', hex: 'x', has_script: true, registered: false },
      ];

      const { valid, invalidCount } = validateArray(data, KoiosDRepListItemSchema, 'test');
      expect(valid).toHaveLength(2);
      expect(invalidCount).toBe(0);
    });
  });
});
