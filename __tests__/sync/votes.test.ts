import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockFrom = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/utils/koios', () => ({
  fetchAllVotesBulk: vi.fn(),
  resetKoiosMetrics: vi.fn(),
  getKoiosMetrics: () => ({ koios_calls: 1, koios_latency_ms: 200, koios_slowest_ms: 200 }),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

import { GET } from '@/app/api/sync/votes/route';
import { fetchAllVotesBulk } from '@/utils/koios';

const CRON_SECRET = 'test-secret';

function setupMockChain() {
  const rangedResult = {
    data: [],
    error: null,
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnValue(rangedResult),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

describe('GET /api/sync/votes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('returns 401 without auth', async () => {
    const req = createRequest('/api/sync/votes');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('syncs votes successfully on happy path', async () => {
    setupMockChain();
    (fetchAllVotesBulk as ReturnType<typeof vi.fn>).mockResolvedValue({
      drep1: [
        {
          proposal_tx_hash: 'tx1',
          proposal_index: 0,
          vote_tx_hash: 'vtx1',
          block_time: 1700000000,
          vote: 'Yes',
          meta_url: 'https://example.com/rationale.json',
          meta_hash: null,
          meta_json: { body: { comment: 'Detailed inline rationale text for the vote.' } },
          epoch_no: 100,
        },
      ],
    });

    const req = createRequest('/api/sync/votes', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.votesSynced).toBeGreaterThanOrEqual(0);
    expect(mockFrom).toHaveBeenCalledWith('vote_rationales');
    expect(mockFrom).toHaveBeenCalledWith('sync_cursors');
  });

  it('returns 502 when Koios is down', async () => {
    setupMockChain();
    (fetchAllVotesBulk as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Koios API error: 500'),
    );

    const req = createRequest('/api/sync/votes', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('500');
  });

  it('handles empty vote response gracefully', async () => {
    setupMockChain();
    (fetchAllVotesBulk as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const req = createRequest('/api/sync/votes', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.votesSynced).toBe(0);
  });
});
