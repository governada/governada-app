import { afterEach, describe, expect, it, vi } from 'vitest';
import { callSyncRoute } from '@/inngest/helpers';

describe('callSyncRoute', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('refuses to fall back to localhost in Railway production', async () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', 'env_prod');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('CRON_SECRET', 'cron-secret');

    await expect(callSyncRoute('/api/admin/api-health/alert', 1000)).rejects.toThrow(
      'NEXT_PUBLIC_SITE_URL not configured',
    );
  });

  it('keeps localhost fallback available outside production for local development', async () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT_ID', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await callSyncRoute('/api/admin/api-health/alert', 1000);

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/api-health/alert',
      expect.objectContaining({
        headers: { Authorization: 'Bearer cron-secret' },
      }),
    );
  });
});
