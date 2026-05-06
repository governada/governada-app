import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOpsEnvReport } from '@/lib/env';

describe('getOpsEnvReport', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports healthy when all ops-critical wiring is present', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
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
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
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
        expect.objectContaining({ key: 'NEXT_PUBLIC_SUPABASE_URL' }),
      ]),
    );
    expect(report.missingGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'alert_webhook' }),
        expect.objectContaining({ name: 'supabase_read_key' }),
      ]),
    );
  });

  it('accepts the legacy anon key for the Supabase read key group', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'legacy-anon-key');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://governada.io');
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1');
    vi.stubEnv('HEARTBEAT_URL_PROPOSALS', 'https://betterstack.example/proposals');
    vi.stubEnv('HEARTBEAT_URL_BATCH', 'https://betterstack.example/batch');
    vi.stubEnv('HEARTBEAT_URL_DAILY', 'https://betterstack.example/daily');
    vi.stubEnv('DISCORD_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/abc');

    expect(getOpsEnvReport().status).toBe('healthy');
  });
});
