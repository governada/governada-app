import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockRows = {
  value: [] as Array<Record<string, unknown>>,
};

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      select: vi.fn(() => Promise.resolve({ data: mockRows.value, error: null })),
    }),
  }),
}));

import { GET } from '@/app/api/health/sync/route';

describe('GET /api/health/sync', () => {
  beforeEach(() => {
    mockRows.value = [];
    vi.clearAllMocks();
  });

  it('returns 503 when no sync data exists', async () => {
    const res = await GET();
    const body = (await parseJson(res)) as { status: string };

    expect(res.status).toBe(503);
    expect(body.status).toBe('unknown');
  });

  it('keeps proposal sync healthy before the external threshold is crossed', async () => {
    mockRows.value = [
      {
        sync_type: 'proposals',
        last_run: new Date(Date.now() - 100 * 60 * 1000).toISOString(),
        last_success: true,
      },
      {
        sync_type: 'dreps',
        last_run: new Date().toISOString(),
        last_success: true,
      },
      {
        sync_type: 'scoring',
        last_run: new Date().toISOString(),
        last_success: true,
      },
      {
        sync_type: 'alignment',
        last_run: new Date().toISOString(),
        last_success: true,
      },
    ];

    const res = await GET();
    const body = (await parseJson(res)) as {
      status: string;
      core_syncs: Array<{ type: string; stale: boolean }>;
    };

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.core_syncs.find((sync) => sync.type === 'proposals')?.stale).toBe(false);
  });

  it('returns 503 once a core sync crosses the external threshold', async () => {
    mockRows.value = [
      {
        sync_type: 'proposals',
        last_run: new Date(Date.now() - 121 * 60 * 1000).toISOString(),
        last_success: true,
      },
      {
        sync_type: 'dreps',
        last_run: new Date().toISOString(),
        last_success: true,
      },
      {
        sync_type: 'scoring',
        last_run: new Date().toISOString(),
        last_success: true,
      },
      {
        sync_type: 'alignment',
        last_run: new Date().toISOString(),
        last_success: true,
      },
    ];

    const res = await GET();
    const body = (await parseJson(res)) as {
      status: string;
      core_syncs: Array<{ type: string; stale: boolean }>;
    };

    expect(res.status).toBe(503);
    expect(body.status).toBe('critical');
    expect(body.core_syncs.find((sync) => sync.type === 'proposals')?.stale).toBe(true);
  });
});
