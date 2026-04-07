import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBatchUpsert } = vi.hoisted(() => ({
  mockBatchUpsert: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/lib/sync-utils', () => ({
  SyncLogger: vi.fn(),
  errMsg: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  emitPostHog: vi.fn(),
  batchUpsert: mockBatchUpsert,
}));

vi.mock('@/lib/ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@/utils/koios', () => ({
  fetchDRepVotingPowerHistory: vi.fn(),
  fetchDRepInfo: vi.fn(),
}));

vi.mock('@/utils/proposalPriority', () => ({
  getProposalPriority: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  broadcastDiscord: vi.fn(),
  broadcastEvent: vi.fn(),
}));

vi.mock('@/lib/proposalSimilarity', () => ({
  precomputeSimilarityCache: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  default: {},
  startSpan: (_span: unknown, callback: () => Promise<unknown>) => callback(),
}));

import { runRationalePipeline } from '@/lib/sync/slow';
import { RATIONALE_FETCH_MAX_ATTEMPTS, RATIONALE_FETCH_STATUS } from '@/lib/vote-rationales';

function makeQueuedRow(overrides: Record<string, unknown> = {}) {
  return {
    vote_tx_hash: 'vote-1',
    drep_id: 'drep1',
    proposal_tx_hash: 'tx1',
    proposal_index: 0,
    meta_url: 'https://example.com/rationale.json',
    fetch_status: RATIONALE_FETCH_STATUS.pending,
    fetch_attempts: 0,
    ...overrides,
  };
}

function makeSupabase(queuedRows: Array<Record<string, unknown>>) {
  const query = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: queuedRows, error: null }),
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      expect(table).toBe('vote_rationales');
      return query;
    }),
  };
}

describe('runRationalePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBatchUpsert.mockResolvedValue({ success: 1, errors: 0 });
  });

  it('stores fetched rationale text for queued votes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ body: { comment: 'Fetched rationale text' } }), {
          status: 200,
          headers: { 'content-length': '42' },
        }),
      ),
    );

    const supabase = makeSupabase([makeQueuedRow()]);
    const result = await runRationalePipeline(supabase as never);

    expect(result).toEqual({ fetched: 1, retried: 0, failed: 0, queued: 1 });
    expect(mockBatchUpsert).toHaveBeenCalledTimes(1);
    expect(mockBatchUpsert.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({
        vote_tx_hash: 'vote-1',
        rationale_text: 'Fetched rationale text',
        fetch_status: RATIONALE_FETCH_STATUS.fetched,
        fetch_attempts: 1,
        next_fetch_at: null,
      }),
    );
  });

  it('keeps retryable failures in the queue with backoff', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('temporary failure', { status: 503 })),
    );

    const supabase = makeSupabase([
      makeQueuedRow({
        fetch_status: RATIONALE_FETCH_STATUS.retry,
        fetch_attempts: 1,
      }),
    ]);
    const result = await runRationalePipeline(supabase as never);

    expect(result).toEqual({ fetched: 0, retried: 1, failed: 0, queued: 1 });
    expect(mockBatchUpsert.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({
        vote_tx_hash: 'vote-1',
        fetch_status: RATIONALE_FETCH_STATUS.retry,
        fetch_attempts: 2,
        fetch_last_error: 'http_503',
      }),
    );
    expect(mockBatchUpsert.mock.calls[0][2][0].next_fetch_at).toBeTruthy();
  });

  it('marks rows failed after the max retry budget is exhausted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('temporary failure', { status: 503 })),
    );

    const supabase = makeSupabase([
      makeQueuedRow({
        fetch_status: RATIONALE_FETCH_STATUS.retry,
        fetch_attempts: RATIONALE_FETCH_MAX_ATTEMPTS - 1,
      }),
    ]);
    const result = await runRationalePipeline(supabase as never);

    expect(result).toEqual({ fetched: 0, retried: 0, failed: 1, queued: 1 });
    expect(mockBatchUpsert.mock.calls[0][2][0]).toEqual(
      expect.objectContaining({
        vote_tx_hash: 'vote-1',
        fetch_status: RATIONALE_FETCH_STATUS.failed,
        fetch_attempts: RATIONALE_FETCH_MAX_ATTEMPTS,
        fetch_last_error: 'http_503',
        next_fetch_at: null,
      }),
    );
  });
});
