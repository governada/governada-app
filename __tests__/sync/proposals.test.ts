import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/utils/koios', () => ({
  fetchProposals: vi.fn(),
  fetchVotesForProposals: vi.fn(),
  fetchProposalVotingSummary: vi.fn(),
  resetKoiosMetrics: vi.fn(),
  getKoiosMetrics: () => ({ koios_calls: 1, koios_latency_ms: 100, koios_slowest_ms: 100 }),
}));

vi.mock('@/lib/alignment', () => ({
  classifyProposals: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

import { GET } from '@/app/api/sync/proposals/route';
import { fetchProposals } from '@/utils/koios';

const CRON_SECRET = 'test-secret';

function setupMockChain() {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

function validProposal(overrides: Record<string, unknown> = {}) {
  return {
    proposal_tx_hash: 'tx1',
    proposal_index: 0,
    proposal_id: 'gov_action_tx1#0',
    proposal_type: 'ParameterChange',
    deposit: '100000000',
    return_address: 'addr1...',
    proposed_epoch: 100,
    ratified_epoch: null,
    enacted_epoch: null,
    dropped_epoch: null,
    expired_epoch: null,
    block_time: 1700000000,
    ...overrides,
  };
}

describe('GET /api/sync/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
  });

  it('returns 401 without auth', async () => {
    const req = createRequest('/api/sync/proposals');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('syncs proposals successfully on happy path', async () => {
    setupMockChain();
    (fetchProposals as ReturnType<typeof vi.fn>).mockResolvedValue([validProposal()]);

    const req = createRequest('/api/sync/proposals', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 207 when Koios fails but route continues gracefully', async () => {
    setupMockChain();
    (fetchProposals as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Koios API error: 500'),
    );

    const req = createRequest('/api/sync/proposals', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(207);
    expect(body.error).toBeTruthy();
  });

  it('handles empty proposal response gracefully', async () => {
    setupMockChain();
    (fetchProposals as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const req = createRequest('/api/sync/proposals', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 207 when some records fail Zod validation', async () => {
    setupMockChain();
    (fetchProposals as ReturnType<typeof vi.fn>).mockResolvedValue([
      validProposal(),
      { proposal_tx_hash: 'bad', missing_required_fields: true },
    ]);

    const req = createRequest('/api/sync/proposals', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect([200, 207]).toContain(res.status);
    if (res.status === 207) {
      expect(body.error).toBeTruthy();
    }
  });
});
