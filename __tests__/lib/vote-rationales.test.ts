import { describe, expect, it } from 'vitest';

import {
  planVoteRationaleUpserts,
  RATIONALE_FETCH_STATUS,
  type ExistingVoteRationaleRow,
  type StoredVoteRationaleRow,
} from '@/lib/vote-rationales';

function makePendingRow(overrides: Partial<StoredVoteRationaleRow> = {}): StoredVoteRationaleRow {
  return {
    vote_tx_hash: 'vote-1',
    drep_id: 'drep1',
    proposal_tx_hash: 'tx1',
    proposal_index: 0,
    meta_url: 'https://example.com/rationale.json',
    rationale_text: null,
    fetched_at: null,
    fetch_status: RATIONALE_FETCH_STATUS.pending,
    fetch_attempts: 0,
    fetch_last_attempted_at: null,
    fetch_last_error: null,
    next_fetch_at: '2026-04-06T12:00:00.000Z',
    ...overrides,
  };
}

function makeExistingRow(
  overrides: Partial<ExistingVoteRationaleRow> = {},
): ExistingVoteRationaleRow {
  return {
    vote_tx_hash: 'vote-1',
    drep_id: 'drep1',
    proposal_tx_hash: 'tx1',
    proposal_index: 0,
    meta_url: 'https://example.com/rationale.json',
    rationale_text: null,
    fetched_at: null,
    fetch_status: RATIONALE_FETCH_STATUS.retry,
    fetch_attempts: 2,
    fetch_last_attempted_at: '2026-04-05T12:00:00.000Z',
    fetch_last_error: 'http_503',
    next_fetch_at: '2026-04-07T12:00:00.000Z',
    ...overrides,
  };
}

describe('planVoteRationaleUpserts', () => {
  it('preserves existing retry state when the same anchor is rediscovered', () => {
    const planned = planVoteRationaleUpserts(
      [makePendingRow()],
      new Map([['vote-1', makeExistingRow()]]),
    );

    expect(planned).toEqual([]);
  });

  it('resets stale rationale state when a vote anchor changes', () => {
    const planned = planVoteRationaleUpserts(
      [
        makePendingRow({
          meta_url: 'https://example.com/new-rationale.json',
        }),
      ],
      new Map([
        [
          'vote-1',
          makeExistingRow({
            rationale_text: 'Old rationale',
            fetched_at: '2026-04-05T13:00:00.000Z',
            fetch_status: RATIONALE_FETCH_STATUS.fetched,
            fetch_attempts: 3,
          }),
        ],
      ]),
    );

    expect(planned).toEqual([
      expect.objectContaining({
        vote_tx_hash: 'vote-1',
        meta_url: 'https://example.com/new-rationale.json',
        rationale_text: null,
        fetch_status: RATIONALE_FETCH_STATUS.pending,
        fetch_attempts: 0,
        ai_summary: null,
        hash_verified: null,
        hash_check_attempted_at: null,
      }),
    ]);
  });

  it('promotes inline rationale to terminal success without leaving retry state behind', () => {
    const planned = planVoteRationaleUpserts(
      [
        makePendingRow({
          rationale_text: 'Inline rationale',
          fetched_at: '2026-04-06T12:00:00.000Z',
          fetch_status: RATIONALE_FETCH_STATUS.inline,
          next_fetch_at: null,
        }),
      ],
      new Map([['vote-1', makeExistingRow()]]),
    );

    expect(planned).toEqual([
      expect.objectContaining({
        vote_tx_hash: 'vote-1',
        rationale_text: 'Inline rationale',
        fetch_status: RATIONALE_FETCH_STATUS.inline,
        fetch_attempts: 2,
        fetch_last_error: null,
        next_fetch_at: null,
      }),
    ]);
  });
});
