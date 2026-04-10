import type { ReconciliationReport } from './types';
import { capMsg } from '@/lib/sync-utils';

export function buildReconciliationSyncLogEntry(report: ReconciliationReport, runTier2: boolean) {
  const finishedAtMs = new Date(report.checkedAt).getTime();
  const errorMessage =
    report.overallStatus === 'match'
      ? null
      : capMsg(
          `Reconciliation ${report.overallStatus}: ${report.mismatches.length} of ${report.results.length} checks outside tolerance`,
        );

  return {
    sync_type: 'reconciliation',
    started_at: new Date(finishedAtMs - report.durationMs).toISOString(),
    finished_at: report.checkedAt,
    duration_ms: report.durationMs,
    // Reconciliation is a diagnostic check. Drift or mismatch means the job ran
    // and found issues, not that the execution itself failed.
    success: true,
    ...(errorMessage ? { error_message: errorMessage } : {}),
    metrics: {
      overall_status: report.overallStatus,
      checks: report.results.length,
      mismatches: report.mismatches.length,
      tier_scope: runTier2 ? 'tier1+tier2' : 'tier1',
    },
  };
}
