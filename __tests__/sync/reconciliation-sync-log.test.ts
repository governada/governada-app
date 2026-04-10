import { describe, expect, it } from 'vitest';
import { buildReconciliationSyncLogEntry } from '@/lib/reconciliation/sync-log';
import type { ReconciliationReport } from '@/lib/reconciliation/types';

function makeReport(overallStatus: ReconciliationReport['overallStatus']): ReconciliationReport {
  return {
    checkedAt: '2026-04-04T10:00:00.000Z',
    source: 'blockfrost',
    overallStatus,
    results: [
      {
        metric: 'Total proposals',
        tier: 1,
        ours: 10,
        theirs: 11,
        status: overallStatus,
      },
    ],
    mismatches:
      overallStatus === 'match'
        ? []
        : [
            {
              metric: 'Total proposals',
              tier: 1,
              ours: 10,
              theirs: 11,
              status: overallStatus,
            },
          ],
    durationMs: 1500,
  };
}

describe('buildReconciliationSyncLogEntry', () => {
  it.each(['match', 'drift', 'mismatch'] as const)(
    'records %s as a successful diagnostic execution',
    (overallStatus) => {
      const entry = buildReconciliationSyncLogEntry(makeReport(overallStatus), true);

      expect(entry.success).toBe(true);
      expect(entry.metrics.overall_status).toBe(overallStatus);
      expect(entry.metrics.tier_scope).toBe('tier1+tier2');
    },
  );

  it.each(['drift', 'mismatch'] as const)(
    'surfaces %s runs in sync_log error_message',
    (overallStatus) => {
      const entry = buildReconciliationSyncLogEntry(makeReport(overallStatus), false);

      expect(entry.error_message).toContain(`Reconciliation ${overallStatus}`);
      expect(entry.error_message).toContain('checks outside tolerance');
    },
  );

  it('preserves mismatch counts while keeping execution success separate', () => {
    const entry = buildReconciliationSyncLogEntry(makeReport('mismatch'), false);

    expect(entry.metrics.mismatches).toBe(1);
    expect(entry.metrics.checks).toBe(1);
    expect(entry.metrics.tier_scope).toBe('tier1');
    expect(entry.started_at).toBe('2026-04-04T09:59:58.500Z');
    expect(entry.finished_at).toBe('2026-04-04T10:00:00.000Z');
  });
});
