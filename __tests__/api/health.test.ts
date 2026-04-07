import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockState = {
  syncRows: [] as Array<Record<string, unknown>>,
  syncError: null as Error | null,
  currentEpoch: 0,
  snapshotError: null as Error | null,
  snapshotLatest: {} as Record<string, Record<string, unknown> | null>,
};

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'v_sync_health') {
        return {
          select: vi.fn(() => {
            if (mockState.syncError) {
              return Promise.reject(mockState.syncError);
            }
            return Promise.resolve({ data: mockState.syncRows, error: null });
          }),
        };
      }

      if (table === 'governance_stats') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() =>
                Promise.resolve({
                  data: { current_epoch: mockState.currentEpoch },
                  error: null,
                }),
              ),
            })),
          })),
        };
      }

      return {
        select: vi.fn((column: string) => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(() => {
                if (mockState.snapshotError) {
                  return Promise.reject(mockState.snapshotError);
                }

                return Promise.resolve({
                  data:
                    table in mockState.snapshotLatest
                      ? mockState.snapshotLatest[table]
                      : column === 'snapshot_date'
                        ? { snapshot_date: new Date().toISOString().slice(0, 10) }
                        : { [column]: mockState.currentEpoch },
                  error: null,
                });
              }),
            })),
          })),
        })),
      };
    },
  }),
}));

import { GET } from '@/app/api/health/route';

function makeReq() {
  return createRequest('/api/health');
}

describe('GET /api/health', () => {
  beforeEach(() => {
    mockState.syncRows = [];
    mockState.syncError = null;
    mockState.currentEpoch = 0;
    mockState.snapshotError = null;
    mockState.snapshotLatest = {};
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://governada.io');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1');
    vi.stubEnv('HEARTBEAT_URL_PROPOSALS', 'https://betterstack.example/proposals');
    vi.stubEnv('HEARTBEAT_URL_BATCH', 'https://betterstack.example/batch');
    vi.stubEnv('HEARTBEAT_URL_DAILY', 'https://betterstack.example/daily');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/abc');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns "unknown" when no sync data exists', async () => {
    const res = await GET(makeReq());
    const body = (await parseJson(res)) as { status: string; syncs: unknown[] };

    expect(res.status).toBe(200);
    expect(body.status).toBe('unknown');
    expect(body.syncs).toEqual([]);
  });

  it('returns "healthy" when all syncs are recent and successful', async () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', 'env_123');
    vi.stubEnv('RAILWAY_GIT_COMMIT_SHA', 'ABCDEF123456');
    const now = new Date().toISOString();
    mockState.syncRows = [
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
    ];

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as {
      status: string;
      syncs: Array<{ level: string }>;
      release: { commit_sha: string };
    };

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.syncs).toHaveLength(2);
    expect(body.release.commit_sha).toBe('abcdef123456');
    body.syncs.forEach((s) => expect(s.level).toBe('healthy'));
  });

  it('returns "critical" when a sync has last_success false', async () => {
    mockState.syncRows = [
      {
        sync_type: 'dreps',
        last_run: new Date().toISOString(),
        last_success: false,
        success_count: 0,
        failure_count: 3,
      },
    ];

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as {
      status: string;
      syncs: Array<{ level: string }>;
    };

    expect(body.status).toBe('critical');
    expect(body.syncs[0]?.level).toBe('critical');
  });

  it('returns "degraded" when a sync is stale but not critical', async () => {
    const staleTime = new Date(Date.now() - 100 * 60 * 1000).toISOString();
    mockState.syncRows = [
      {
        sync_type: 'proposals',
        last_run: staleTime,
        last_success: true,
        success_count: 5,
        failure_count: 0,
      },
    ];

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as {
      status: string;
      syncs: Array<{ level: string }>;
    };

    expect(body.status).toBe('degraded');
    expect(body.syncs[0]?.level).toBe('degraded');
  });

  it('surfaces snapshot diagnostic failures instead of swallowing them', async () => {
    mockState.syncRows = [
      {
        sync_type: 'proposals',
        last_run: new Date().toISOString(),
        last_success: true,
        success_count: 5,
        failure_count: 0,
      },
    ];
    mockState.currentEpoch = 100;
    mockState.snapshotError = new Error('snapshot query failed');

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as {
      status: string;
      snapshots: { status: string; error: string };
    };

    expect(body.status).toBe('degraded');
    expect(body.snapshots.status).toBe('unavailable');
    expect(body.snapshots.error).toBe('snapshot health check failed');
  });

  it('degrades when ops-critical env wiring is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    mockState.syncRows = [
      {
        sync_type: 'proposals',
        last_run: new Date().toISOString(),
        last_success: true,
        success_count: 5,
        failure_count: 0,
      },
    ];

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as {
      operations: { missing: Array<{ key: string }>; status: string };
      status: string;
    };

    expect(body.status).toBe('degraded');
    expect(body.operations.status).toBe('degraded');
    expect(body.operations.missing).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'NEXT_PUBLIC_SENTRY_DSN' })]),
    );
  });

  it('returns 500 on unexpected sync query error', async () => {
    mockState.syncError = new Error('DB connection failed');

    const res = await GET(makeReq());
    const body = (await parseJson(res)) as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
