import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { checkKoiosHealthFast, ping } = vi.hoisted(() => ({
  checkKoiosHealthFast: vi.fn(),
  ping: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          abortSignal: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    }),
  }),
}));

vi.mock('@/utils/koios', () => ({
  checkKoiosHealthFast,
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    ping,
  }),
}));

import { GET } from '@/app/api/health/deep/route';

function makeReq() {
  return createRequest('/api/health/deep');
}

describe('GET /api/health/deep', () => {
  beforeEach(() => {
    checkKoiosHealthFast.mockResolvedValue(true);
    ping.mockResolvedValue('PONG');
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

  it('returns healthy when dependencies and ops wiring are healthy', async () => {
    const response = await GET(makeReq());
    const body = (await parseJson(response)) as {
      dependencies: { operational_env: { status: string } };
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.dependencies.operational_env.status).toBe('healthy');
  });

  it('degrades when ops-critical wiring is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');

    const response = await GET(makeReq());
    const body = (await parseJson(response)) as {
      dependencies: {
        operational_env: { missing: Array<{ key: string }>; status: string };
      };
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.dependencies.operational_env.status).toBe('unhealthy');
    expect(body.dependencies.operational_env.missing).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'NEXT_PUBLIC_SENTRY_DSN' })]),
    );
  });
});
