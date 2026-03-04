import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockSelect = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({ select: mockSelect }),
  }),
}));

import { GET } from '@/app/api/health/route';

function makeReq() {
  return createRequest('/api/health');
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "unknown" when no sync data exists', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.status).toBe('unknown');
    expect(body.syncs).toEqual([]);
  });

  it('returns "healthy" when all syncs are recent and successful', async () => {
    const now = new Date().toISOString();
    mockSelect.mockResolvedValue({
      data: [
        {
          sync_type: 'proposals',
          last_run: now,
          last_success: true,
          success_count: 10,
          failure_count: 0,
        },
        {
          sync_type: 'treasury',
          last_run: now,
          last_success: true,
          success_count: 5,
          failure_count: 0,
        },
      ],
      error: null,
    });

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.syncs).toHaveLength(2);
    body.syncs.forEach((s: any) => expect(s.level).toBe('healthy'));
  });

  it('returns "critical" when a sync has last_success false', async () => {
    mockSelect.mockResolvedValue({
      data: [
        {
          sync_type: 'dreps',
          last_run: new Date().toISOString(),
          last_success: false,
          success_count: 0,
          failure_count: 3,
        },
      ],
      error: null,
    });

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as any;

    expect(body.status).toBe('critical');
    expect(body.syncs[0].level).toBe('critical');
  });

  it('returns "degraded" when a sync is stale but not double-stale', async () => {
    const staleTime = new Date(Date.now() - 800 * 60 * 1000).toISOString(); // 800 min ago (threshold for dreps is 720)
    mockSelect.mockResolvedValue({
      data: [
        {
          sync_type: 'dreps',
          last_run: staleTime,
          last_success: true,
          success_count: 5,
          failure_count: 0,
        },
      ],
      error: null,
    });

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as any;

    expect(body.status).toBe('degraded');
    expect(body.syncs[0].level).toBe('degraded');
  });

  it('returns 500 on unexpected error', async () => {
    mockSelect.mockRejectedValue(new Error('DB connection failed'));

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
