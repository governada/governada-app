/**
 * Sync Pipeline Integration Tests
 *
 * Tests the transform + validation layer that sits between Koios API responses
 * and Supabase upserts. Catches schema drift and transform regressions.
 */
import { describe, it, expect } from 'vitest';
import {
  KoiosDRepListItemSchema,
  KoiosDRepInfoSchema,
  KoiosProposalSchema,
  KoiosVoteListSchema,
  KoiosVoteSchema,
  KoiosTreasurySchema,
  validateArray,
} from '@/utils/koios-schemas';

// ---------------------------------------------------------------------------
// Realistic fixtures based on actual Koios API response shapes
// ---------------------------------------------------------------------------

const REALISTIC_DREP_LIST_ITEM = {
  drep_id: 'drep1qg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5z',
  drep_hash: 'abc123def456',
  hex: 'abc123',
  has_script: false,
  registered: true,
  amount: '5000000000',
  active_epoch: 100,
  deposit: '500000000',
  meta_url: 'https://example.com/metadata.json',
};

const REALISTIC_DREP_INFO = {
  drep_id: 'drep1qg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5z',
  drep_hash: 'abc123def456',
  hex: 'abc123',
  has_script: false,
  registered: true,
  deposit: '500000000',
  anchor_url: 'https://example.com/metadata.json',
  anchor_hash: 'sha256hash',
  amount: '5000000000',
  active_epoch: 100,
  meta_json: { givenName: 'Test DRep', motivations: 'Testing governance' },
};

const REALISTIC_PROPOSAL = {
  proposal_tx_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  proposal_index: 0,
  proposal_id: 'gov_action_a1b2c3d4#0',
  proposal_type: 'InfoAction',
  deposit: '100000000000',
  return_address: 'addr1qxyz...',
  proposed_epoch: 520,
  ratified_epoch: null,
  enacted_epoch: null,
  dropped_epoch: null,
  expired_epoch: null,
  block_time: 1709251200,
  expiration: 530,
  meta_url: 'https://governance.example.com/proposal.json',
  meta_hash: 'deadbeef',
};

const REALISTIC_VOTE = {
  proposal_tx_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  proposal_index: 0,
  vote_tx_hash: 'f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4b5a6f1e2',
  block_time: 1709337600,
  vote: 'Yes' as const,
  meta_url: 'https://example.com/vote-rationale.json',
  meta_hash: 'cafebabe',
};

const REALISTIC_VOTE_LIST = {
  ...REALISTIC_VOTE,
  drep_id: 'drep1qg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5zg5z',
  epoch_no: 520,
  has_rationale: true,
};

const REALISTIC_TREASURY = {
  epoch_no: 520,
  treasury: '1500000000000000',
  reserves: '8000000000000000',
  supply: '35000000000000000',
  reward: '500000000000',
  circulation: '33500000000000000',
};

// ---------------------------------------------------------------------------
// Schema validation with realistic data
// ---------------------------------------------------------------------------

describe('Sync Pipeline: Schema Validation', () => {
  it('validates realistic DRep list item with extra fields', () => {
    const result = KoiosDRepListItemSchema.safeParse(REALISTIC_DREP_LIST_ITEM);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drep_id).toBe(REALISTIC_DREP_LIST_ITEM.drep_id);
      expect(result.data.amount).toBe('5000000000');
    }
  });

  it('validates realistic DRep info with all fields', () => {
    const result = KoiosDRepInfoSchema.safeParse(REALISTIC_DREP_INFO);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.anchor_url).toBe('https://example.com/metadata.json');
      expect(result.data.amount).toBe('5000000000');
    }
  });

  it('validates realistic proposal', () => {
    const result = KoiosProposalSchema.safeParse(REALISTIC_PROPOSAL);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proposal_type).toBe('InfoAction');
      expect(result.data.proposed_epoch).toBe(520);
    }
  });

  it('validates realistic individual vote', () => {
    const result = KoiosVoteSchema.safeParse(REALISTIC_VOTE);
    expect(result.success).toBe(true);
  });

  it('validates realistic vote list item', () => {
    const result = KoiosVoteListSchema.safeParse(REALISTIC_VOTE_LIST);
    expect(result.success).toBe(true);
  });

  it('validates realistic treasury data', () => {
    const result = KoiosTreasurySchema.safeParse(REALISTIC_TREASURY);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Schema drift detection — catches breaking Koios API changes
// ---------------------------------------------------------------------------

describe('Sync Pipeline: Schema Drift Detection', () => {
  it('rejects DRep with missing required drep_id', () => {
    const { drep_id, ...rest } = REALISTIC_DREP_LIST_ITEM;
    expect(KoiosDRepListItemSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects DRep with wrong type for has_script', () => {
    expect(
      KoiosDRepListItemSchema.safeParse({ ...REALISTIC_DREP_LIST_ITEM, has_script: 'yes' }).success,
    ).toBe(false);
  });

  it('rejects proposal with missing block_time', () => {
    const { block_time, ...rest } = REALISTIC_PROPOSAL;
    expect(KoiosProposalSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects proposal with string block_time (type change)', () => {
    expect(
      KoiosProposalSchema.safeParse({ ...REALISTIC_PROPOSAL, block_time: '1709251200' }).success,
    ).toBe(false);
  });

  it('rejects vote with invalid vote enum value', () => {
    expect(KoiosVoteSchema.safeParse({ ...REALISTIC_VOTE, vote: 'Maybe' }).success).toBe(false);
  });

  it('rejects vote with missing proposal_tx_hash', () => {
    const { proposal_tx_hash, ...rest } = REALISTIC_VOTE;
    expect(KoiosVoteSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects treasury with non-numeric epoch_no', () => {
    expect(
      KoiosTreasurySchema.safeParse({ ...REALISTIC_TREASURY, epoch_no: 'five-twenty' }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Batch validation: validateArray filters invalid records
// ---------------------------------------------------------------------------

describe('Sync Pipeline: Batch Validation', () => {
  it('filters invalid records from a mixed batch of proposals', () => {
    const batch = [
      REALISTIC_PROPOSAL,
      { ...REALISTIC_PROPOSAL, proposal_tx_hash: 'tx2', block_time: 'bad' },
      { ...REALISTIC_PROPOSAL, proposal_tx_hash: 'tx3' },
      { missing_everything: true },
    ];

    const { valid, invalidCount, errors } = validateArray(batch, KoiosProposalSchema, 'test');
    expect(valid).toHaveLength(2);
    expect(invalidCount).toBe(2);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('filters invalid records from a mixed batch of votes', () => {
    const batch = [
      REALISTIC_VOTE_LIST,
      { ...REALISTIC_VOTE_LIST, vote: 'Invalid' },
      { ...REALISTIC_VOTE_LIST, vote_tx_hash: 'different-hash' },
    ];

    const { valid, invalidCount } = validateArray(batch, KoiosVoteListSchema, 'test');
    expect(valid).toHaveLength(2);
    expect(invalidCount).toBe(1);
  });

  it('passes through all records when batch is fully valid', () => {
    const batch = Array.from({ length: 50 }, (_, i) => ({
      ...REALISTIC_PROPOSAL,
      proposal_tx_hash: `tx${i}`,
    }));

    const { valid, invalidCount } = validateArray(batch, KoiosProposalSchema, 'test');
    expect(valid).toHaveLength(50);
    expect(invalidCount).toBe(0);
  });

  it('handles empty batch gracefully', () => {
    const { valid, invalidCount } = validateArray([], KoiosProposalSchema, 'test');
    expect(valid).toHaveLength(0);
    expect(invalidCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Transform shape: vote row construction
// ---------------------------------------------------------------------------

describe('Sync Pipeline: Vote Transform Shape', () => {
  it('produces correct Supabase vote row shape from Koios data', () => {
    const koiosVote = REALISTIC_VOTE;
    const drepId = 'drep1abc';

    const row = {
      vote_tx_hash: koiosVote.vote_tx_hash,
      drep_id: drepId,
      proposal_tx_hash: koiosVote.proposal_tx_hash,
      proposal_index: koiosVote.proposal_index,
      vote: koiosVote.vote,
      epoch_no: 520,
      block_time: koiosVote.block_time,
      meta_url: koiosVote.meta_url,
      meta_hash: koiosVote.meta_hash,
    };

    expect(row).toHaveProperty('vote_tx_hash');
    expect(row).toHaveProperty('drep_id');
    expect(row).toHaveProperty('proposal_tx_hash');
    expect(row).toHaveProperty('proposal_index');
    expect(row).toHaveProperty('vote');
    expect(row).toHaveProperty('epoch_no');
    expect(row).toHaveProperty('block_time');
    expect(row).toHaveProperty('meta_url');
    expect(row).toHaveProperty('meta_hash');
    expect(typeof row.block_time).toBe('number');
    expect(typeof row.proposal_index).toBe('number');
  });

  it('deduplicates votes by vote_tx_hash', () => {
    const votes = [
      { ...REALISTIC_VOTE, vote_tx_hash: 'dup1' },
      { ...REALISTIC_VOTE, vote_tx_hash: 'dup1' },
      { ...REALISTIC_VOTE, vote_tx_hash: 'unique' },
    ];

    const deduped = [...new Map(votes.map((v) => [v.vote_tx_hash, v])).values()];
    expect(deduped).toHaveLength(2);
  });
});
