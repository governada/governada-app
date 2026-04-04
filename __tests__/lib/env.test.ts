import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOpsEnvReport } from '@/lib/env';

describe('getOpsEnvReport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports healthy when all ops-critical wiring is present', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://governada.io');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1');
    vi.stubEnv('HEARTBEAT_URL_PROPOSALS', 'https://betterstack.example/proposals');
    vi.stubEnv('HEARTBEAT_URL_BATCH', 'https://betterstack.example/batch');
    vi.stubEnv('HEARTBEAT_URL_DAILY', 'https://betterstack.example/daily');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/abc');

    expect(getOpsEnvReport()).toEqual({
      invalid: [],
      missing: [],
      missingGroups: [],
      status: 'healthy',
    });
  });

  it('reports degraded when required ops wiring is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    vi.stubEnv('HEARTBEAT_URL_PROPOSALS', 'https://betterstack.example/proposals');
    vi.stubEnv('HEARTBEAT_URL_BATCH', 'https://betterstack.example/batch');
    vi.stubEnv('HEARTBEAT_URL_DAILY', 'https://betterstack.example/daily');

    const report = getOpsEnvReport();

    expect(report.status).toBe('degraded');
    expect(report.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'NEXT_PUBLIC_SITE_URL' }),
        expect.objectContaining({ key: 'NEXT_PUBLIC_SENTRY_DSN' }),
      ]),
    );
    expect(report.missingGroups).toEqual([expect.objectContaining({ name: 'alert_webhook' })]);
  });
});
