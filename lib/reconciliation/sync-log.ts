import type { ReconciliationReport } from './types';
import { capMsg } from '@/lib/sync-utils';

export type ReconciliationTierScope = 'tier1' | 'tier1+tier2' | 'tier1_sample' | 'tier2';

function normalizeTierScope(scope: boolean | ReconciliationTierScope): ReconciliationTierScope {
  if (typeof scope === 'boolean') return scope ? 'tier1+tier2' : 'tier1';
  return scope;
}

function syncTypeForTierScope(scope: ReconciliationTierScope) {
  switch (scope) {
    case 'tier1_sample':
      return 'tier1_sample';
    case 'tier2':
      return 'tier2';
    default:
      return 'reconciliation';
  }
}

export function buildReconciliationSyncLogEntry(
  report: ReconciliationReport,
  scope: boolean | ReconciliationTierScope,
) {
  const tierScope = normalizeTierScope(scope);
  const finishedAtMs = new Date(report.checkedAt).getTime();
  const errorMessage =
    report.overallStatus === 'match'
      ? null
      : capMsg(
          `Reconciliation ${report.overallStatus}: ${report.mismatches.length} of ${report.results.length} checks outside tolerance`,
        );

  return {
    sync_type: syncTypeForTierScope(tierScope),
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
      tier_scope: tierScope,
    },
  };
}
