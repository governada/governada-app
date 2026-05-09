import { describe, it, expect } from 'vitest';
import {
  KoiosDRepListItemSchema,
  KoiosDRepInfoSchema,
  KoiosProposalSchema,
  KoiosVoteListSchema,
  KoiosTreasurySchema,
  validateArray,
} from '@/utils/koios-schemas';
import { normalizeDRepInfo } from '@/utils/koios';

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

  describe('KoiosDRepInfoSchema', () => {
    it('accepts current Koios DRep detail fields', () => {
      const result = KoiosDRepInfoSchema.safeParse({
        drep_id: 'drep1abc',
        hex: 'abc123',
        has_script: false,
        drep_status: 'registered',
        active: true,
        deposit: '500000000',
        expires_epoch_no: 626,
        amount: '1000000',
        meta_url: 'https://example.com/drep.json',
        meta_hash: 'hash123',
      });

      expect(result.success).toBe(true);
    });

    it('normalizes current Koios detail fields to stable sync fields', () => {
      const normalized = normalizeDRepInfo({
        drep_id: 'drep1abc',
        hex: 'abc123',
        has_script: false,
        drep_status: 'registered',
        active: true,
        deposit: '500000000',
        expires_epoch_no: 626,
        amount: '1000000',
        meta_url: 'https://example.com/drep.json',
        meta_hash: 'hash123',
      });

      expect(normalized).toEqual({
        drepId: 'drep1abc',
        drepHash: 'abc123',
        registered: true,
        active: true,
        amount: '1000000',
        anchorUrl: 'https://example.com/drep.json',
        anchorHash: 'hash123',
      });
    });

    it('normalizes deregistered current Koios detail fields as inactive', () => {
      const normalized = normalizeDRepInfo({
        drep_id: 'drep1abc',
        hex: 'abc123',
        has_script: false,
        drep_status: 'deregistered',
        active: false,
        deposit: null,
        expires_epoch_no: null,
        amount: '0',
        meta_url: null,
        meta_hash: null,
      });

      expect(normalized.registered).toBe(false);
      expect(normalized.active).toBe(false);
      expect(normalized.anchorUrl).toBeNull();
      expect(normalized.anchorHash).toBeNull();
    });

    it('keeps compatibility with legacy Koios DRep detail fields', () => {
      const normalized = normalizeDRepInfo({
        drep_id: 'drep1legacy',
        drep_hash: 'legacyhash',
        hex: 'hexhash',
        has_script: false,
        registered: true,
        deposit: '500000000',
        amount: '2000000',
        anchor_url: 'https://example.com/legacy.json',
        anchor_hash: 'legacy-anchor-hash',
        active_epoch: 620,
      });

      expect(normalized).toEqual({
        drepId: 'drep1legacy',
        drepHash: 'legacyhash',
        registered: true,
        active: true,
        amount: '2000000',
        anchorUrl: 'https://example.com/legacy.json',
        anchorHash: 'legacy-anchor-hash',
      });
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
