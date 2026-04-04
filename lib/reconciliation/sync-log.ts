import type { ReconciliationReport } from './types';

export function buildReconciliationSyncLogEntry(report: ReconciliationReport, runTier2: boolean) {
  const finishedAtMs = new Date(report.checkedAt).getTime();

  return {
    sync_type: 'reconciliation',
    started_at: new Date(finishedAtMs - report.durationMs).toISOString(),
    finished_at: report.checkedAt,
    duration_ms: report.durationMs,
    // Reconciliation is a diagnostic check. Drift or mismatch means the job ran
    // and found issues, not that the execution itself failed.
    success: true,
    metrics: {
      overall_status: report.overallStatus,
      checks: report.results.length,
      mismatches: report.mismatches.length,
      tier_scope: runTier2 ? 'tier1+tier2' : 'tier1',
    },
  };
}
