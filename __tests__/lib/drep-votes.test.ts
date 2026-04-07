import { describe, expect, it } from 'vitest';

import type { DRepVote } from '@/types/koios';
import {
  calculateWeightedRationaleProvisionRate,
  dedupeLatestVotesByProposal,
  normalizeVoteMapForStorage,
} from '@/lib/drep-votes';
import { RATIONALE_FETCH_STATUS } from '@/lib/vote-rationales';

function makeVote(overrides: Partial<DRepVote> = {}): DRepVote {
  return {
    proposal_tx_hash: 'tx1',
    proposal_index: 0,
    vote_tx_hash: 'vote-1',
    block_time: 1_700_000_000,
    vote: 'Yes',
    meta_url: null,
    meta_hash: null,
    meta_json: null,
    epoch_no: 100,
    ...overrides,
  };
}

describe('normalizeVoteMapForStorage', () => {
  it('derives has_rationale from both meta_url and inline rationale text', () => {
    const nowIso = '2026-04-06T12:00:00.000Z';
    const result = normalizeVoteMapForStorage(
      {
        drep1: [
          makeVote({
            vote_tx_hash: 'inline',
            meta_json: { body: { comment: 'Inline rationale from Koios.' } },
          }),
          makeVote({
            vote_tx_hash: 'url',
            proposal_tx_hash: 'tx2',
            meta_url: 'https://example.com/rationale.json',
          }),
        ],
      },
      () => 100,
      nowIso,
    );

    expect(result.voteRows).toHaveLength(2);
    expect(result.voteRows.map((row) => row.has_rationale)).toEqual([true, true]);
    expect(result.rationaleRows).toEqual([
      expect.objectContaining({
        vote_tx_hash: 'inline',
        rationale_text: 'Inline rationale from Koios.',
        fetch_status: RATIONALE_FETCH_STATUS.inline,
        fetched_at: nowIso,
        next_fetch_at: null,
      }),
      expect.objectContaining({
        vote_tx_hash: 'url',
        rationale_text: null,
        fetch_status: RATIONALE_FETCH_STATUS.pending,
        fetched_at: null,
        next_fetch_at: nowIso,
      }),
    ]);
    expect(result.maxBlockTime).toBe(1_700_000_000);
  });
});

describe('dedupeLatestVotesByProposal', () => {
  it('keeps the latest vote per proposal and breaks ties by vote_tx_hash', () => {
    const deduped = dedupeLatestVotesByProposal([
      makeVote({ vote_tx_hash: 'vote-1', block_time: 10 }),
      makeVote({ vote_tx_hash: 'vote-2', block_time: 10 }),
      makeVote({ vote_tx_hash: 'vote-3', proposal_tx_hash: 'tx2', block_time: 9 }),
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped.find((vote) => vote.proposal_tx_hash === 'tx1')?.vote_tx_hash).toBe('vote-2');
  });
});

describe('calculateWeightedRationaleProvisionRate', () => {
  it('uses the cached rationale signal and excludes InfoAction votes', () => {
    const proposalMap = new Map([
      ['tx1-0', { proposalType: 'HardForkInitiation', treasuryTier: null }],
      ['tx2-0', { proposalType: 'TreasuryWithdrawals', treasuryTier: 'major' }],
      ['tx3-0', { proposalType: 'InfoAction', treasuryTier: null }],
    ]);

    const rate = calculateWeightedRationaleProvisionRate(
      [
        makeVote({ proposal_tx_hash: 'tx1', has_rationale: true }),
        makeVote({ proposal_tx_hash: 'tx2', vote_tx_hash: 'vote-2', has_rationale: false }),
        makeVote({ proposal_tx_hash: 'tx3', vote_tx_hash: 'vote-3', has_rationale: false }),
      ],
      proposalMap,
    );

    expect(rate).toBe(60);
  });
});
