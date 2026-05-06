import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockRows = {
  value: [] as Array<Record<string, unknown>>,
  error: null as { message: string } | null,
};

const mockReadClient = {
  value: {
    status: 'healthy',
    reason: 'ok',
    message: 'Supabase read-client query succeeded',
    latencyMs: 1,
    env: {
      url: 'present',
      publishableKey: 'present',
      legacyAnonKey: 'missing',
      activeKey: 'publishable',
    },
  },
};

vi.mock('@/lib/supabase', () => ({
  probeSupabaseReadClient: vi.fn(() => Promise.resolve(mockReadClient.value)),
  createClient: () => ({
    from: () => ({
      select: vi.fn(() => Promise.resolve({ data: mockRows.value, error: mockRows.error })),
    }),
  }),
}));

import { GET } from '@/app/api/health/sync/route';

describe('GET /api/health/sync', () => {
  beforeEach(() => {
    mockRows.value = [];
    mockRows.error = null;
    mockReadClient.value = {
      status: 'healthy',
      reason: 'ok',
      message: 'Supabase read-client query succeeded',
      latencyMs: 1,
      env: {
        url: 'present',
        publishableKey: 'present',
        legacyAnonKey: 'missing',
        activeKey: 'publishable',
      },
    };
    vi.clearAllMocks();
  });

  it('returns 503 when no sync data exists', async () => {
    const res = await GET();
    const body = (await parseJson(res)) as { status: string };

    expect(res.status).toBe(503);
    expect(body.status).toBe('unknown');
  });

  it('returns a structured 503 when the read client is unavailable', async () => {
    mockReadClient.value = {
      status: 'unhealthy',
      reason: 'missing_read_key',
      message: 'Supabase read-client environment is not usable: missing_read_key',
      latencyMs: 0,
      env: {
        url: 'present',
        publishableKey: 'missing',
        legacyAnonKey: 'missing',
        activeKey: 'none',
      },
    };

    const res = await GET();
    const body = (await parseJson(res)) as { status: string; reason: string };

    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.reason).toBe('missing_read_key');
  });

  it('returns a structured 503 when v_sync_health fails', async () => {
    mockRows.error = { message: 'permission denied for view v_sync_health' };

    const res = await GET();
    const body = (await parseJson(res)) as { status: string; reason: string; message: string };

    expect(res.status).toBe(503);
    expect(body.status).toBe('error');
    expect(body.reason).toBe('sync_health_query_error');
    expect(body.message).toContain('permission denied');
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
