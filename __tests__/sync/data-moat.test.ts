import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBatchUpsert,
  mockFetchAll,
  mockGetSyncCursorTimestamp,
  mockSetSyncCursorTimestamp,
  mockFetchDRepMetadata,
  mockGetSupabaseAdmin,
  mockSyncLoggerStart,
  mockSyncLoggerFinalize,
} = vi.hoisted(() => ({
  mockBatchUpsert: vi.fn(),
  mockFetchAll: vi.fn(),
  mockGetSyncCursorTimestamp: vi.fn(),
  mockSetSyncCursorTimestamp: vi.fn(),
  mockFetchDRepMetadata: vi.fn(),
  mockGetSupabaseAdmin: vi.fn(),
  mockSyncLoggerStart: vi.fn(),
  mockSyncLoggerFinalize: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/sync-utils', () => ({
  SyncLogger: vi.fn().mockImplementation(() => ({
    start: mockSyncLoggerStart,
    finalize: mockSyncLoggerFinalize,
  })),
  batchUpsert: mockBatchUpsert,
  fetchAll: mockFetchAll,
  errMsg: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

vi.mock('@/lib/sync/cursors', () => ({
  getSyncCursorTimestamp: mockGetSyncCursorTimestamp,
  setSyncCursorTimestamp: mockSetSyncCursorTimestamp,
}));

vi.mock('@/utils/koios', () => ({
  fetchDRepDelegatorsFull: vi.fn(),
  fetchDRepUpdates: vi.fn(),
  fetchDRepEpochSummary: vi.fn(),
  fetchEpochInfo: vi.fn(),
  fetchCommitteeInfo: vi.fn(),
  fetchDRepMetadata: mockFetchDRepMetadata,
}));

import { syncMetadataArchive } from '@/lib/sync/data-moat';

function makeSupabase() {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'drep_votes') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ vote_tx_hash: 'vote-1', meta_hash: 'vote-hash' }],
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('syncMetadataArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue(makeSupabase());
    mockGetSyncCursorTimestamp
      .mockResolvedValueOnce('2026-04-05T00:00:00.000Z')
      .mockResolvedValueOnce('2026-04-05T00:00:00.000Z')
      .mockResolvedValueOnce('2026-04-05T00:00:00.000Z');
    mockFetchAll
      .mockResolvedValueOnce([
        {
          id: 'drep1',
          anchor_url: 'https://example.com/drep.json',
          anchor_hash: 'drep-hash',
          profile_last_changed_at: '2026-04-06T10:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          tx_hash: 'tx1',
          proposal_index: 0,
          meta_url: 'https://example.com/proposal.json',
          meta_hash: 'proposal-hash',
          meta_json: { body: { title: 'Title', abstract: 'Abstract' } },
          updated_at: '2026-04-06T11:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          vote_tx_hash: 'vote-1',
          meta_url: 'https://example.com/rationale.json',
          rationale_text: 'Because this proposal improves governance.',
          fetched_at: '2026-04-06T12:00:00.000Z',
        },
      ]);
    mockFetchDRepMetadata.mockResolvedValue([
      {
        drep_id: 'drep1',
        meta_url: 'https://example.com/drep.json',
        meta_hash: 'drep-hash',
        meta_json: { body: { givenName: 'DRep One' } },
        is_valid: true,
      },
    ]);
    mockBatchUpsert.mockResolvedValue({ success: 1, errors: 0 });
    mockSyncLoggerStart.mockResolvedValue(undefined);
    mockSyncLoggerFinalize.mockResolvedValue(undefined);
  });

  it('archives only changed metadata streams and advances per-stream cursors', async () => {
    const result = await syncMetadataArchive();

    expect(result).toEqual({
      drepMetadataArchived: 1,
      proposalMetadataArchived: 1,
      rationaleMetadataArchived: 1,
      errors: [],
    });
    expect(mockBatchUpsert).toHaveBeenCalledTimes(3);
    expect(mockSetSyncCursorTimestamp).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'metadata_archive:drep',
      '2026-04-06T10:00:00.000Z',
    );
    expect(mockSetSyncCursorTimestamp).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'metadata_archive:proposal',
      '2026-04-06T11:00:00.000Z',
    );
    expect(mockSetSyncCursorTimestamp).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      'metadata_archive:rationale',
      '2026-04-06T12:00:00.000Z',
    );
  });

  it('does not advance a stream cursor when that stream records errors', async () => {
    mockBatchUpsert
      .mockResolvedValueOnce({ success: 1, errors: 0 })
      .mockResolvedValueOnce({ success: 1, errors: 1 })
      .mockResolvedValueOnce({ success: 1, errors: 0 });

    const result = await syncMetadataArchive();

    expect(result.errors).toContain('Proposal metadata upsert errors: 1');
    expect(mockSetSyncCursorTimestamp).toHaveBeenCalledTimes(2);
    expect(mockSetSyncCursorTimestamp).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'metadata_archive:drep',
      '2026-04-06T10:00:00.000Z',
    );
    expect(mockSetSyncCursorTimestamp).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'metadata_archive:rationale',
      '2026-04-06T12:00:00.000Z',
    );
  });
});
