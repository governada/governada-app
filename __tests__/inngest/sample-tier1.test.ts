import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReconciliationReport } from '@/lib/reconciliation/types';

const createFunctionMock = vi.hoisted(() => vi.fn());
const isAvailableMock = vi.hoisted(() => vi.fn());
const runReconciliationMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const alertDiscordMock = vi.hoisted(() => vi.fn());
const alertCriticalMock = vi.hoisted(() => vi.fn());
const pingHeartbeatMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/inngest', () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

vi.mock('@/lib/reconciliation/blockfrost', () => ({
  isAvailable: isAvailableMock,
}));

vi.mock('@/lib/reconciliation/comparator', () => ({
  runReconciliation: runReconciliationMock,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({ insert: insertMock })),
  }),
}));

vi.mock('@/lib/sync-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sync-utils')>();
  return {
    ...actual,
    alertDiscord: alertDiscordMock,
    alertCritical: alertCriticalMock,
    pingHeartbeat: pingHeartbeatMock,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function makeReport(): ReconciliationReport {
  return {
    checkedAt: '2026-05-09T12:00:00.000Z',
    source: 'blockfrost',
    overallStatus: 'match',
    results: [
      {
        metric: 'Total proposals',
        tier: 1,
        ours: 10,
        theirs: 10,
        status: 'match',
      },
    ],
    mismatches: [],
    durationMs: 250,
  };
}

describe('sampleTier1', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createFunctionMock.mockImplementation((config, handler) => ({ config, handler }));
    isAvailableMock.mockResolvedValue(true);
    runReconciliationMock.mockResolvedValue(makeReport());
    insertMock.mockResolvedValue({ error: null });
    pingHeartbeatMock.mockResolvedValue(undefined);
    alertDiscordMock.mockResolvedValue(undefined);
    alertCriticalMock.mockResolvedValue(undefined);
  });

  it('registers as a 5-minute cron with its own concurrency key', async () => {
    const { sampleTier1 } = await import('@/inngest/functions/sample-tier1');
    const fn = sampleTier1 as unknown as { config: Record<string, unknown> };

    expect(fn.config).toEqual(
      expect.objectContaining({
        id: 'sample-tier1',
        triggers: { cron: '*/5 * * * *' },
        concurrency: { limit: 1, scope: 'env', key: '"sample-tier1"' },
      }),
    );
  });

  it('is registered in the Inngest route', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/inngest/route.ts'), 'utf8');

    expect(route).toContain("import { sampleTier1 } from '@/inngest/functions/sample-tier1'");
    expect(route).toContain('sampleTier1,');
  });

  it('runs Tier 1 only, writes tier1_sample logs, and does not alert on healthy runs', async () => {
    const { sampleTier1 } = await import('@/inngest/functions/sample-tier1');
    const fn = sampleTier1 as unknown as { handler: (input: unknown) => Promise<unknown> };
    const step = {
      run: vi.fn((_name: string, fn: () => unknown) => fn()),
    };

    const result = await fn.handler({ step });

    expect(result).toEqual(
      expect.objectContaining({
        overallStatus: 'match',
        tierScope: 'tier1_sample',
      }),
    );
    expect(runReconciliationMock).toHaveBeenCalledWith({ tier1: true, tier2: false });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tier_scope: 'tier1_sample',
        overall_status: 'match',
      }),
    );
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_type: 'tier1_sample',
        metrics: expect.objectContaining({ tier_scope: 'tier1_sample' }),
      }),
    );
    expect(pingHeartbeatMock).toHaveBeenCalledWith('HEARTBEAT_URL_SAMPLE_TIER1');
    expect(alertDiscordMock).not.toHaveBeenCalled();
    expect(alertCriticalMock).not.toHaveBeenCalled();
  });
});
