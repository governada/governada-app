/**
 * Tier 2 Data Reconciliation — Inngest cron function.
 *
 * Cross-references Governada's Supabase data against Blockfrost's independent
 * Cardano db-sync for the expensive Tier 2 spot checks.
 *
 * Schedule: every 6 hours at :00.
 * Tier 1 continuous sampling lives in sample-tier1.ts.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { alertDiscord, alertCritical } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import { runReconciliation } from '@/lib/reconciliation/comparator';
import { isAvailable } from '@/lib/reconciliation/blockfrost';
import { buildReconciliationSyncLogEntry } from '@/lib/reconciliation/sync-log';
import {
  effectiveStatusAfterSuppression,
  partitionMismatches,
} from '@/lib/reconciliation/alert-suppressions';

export const reconcileData = inngest.createFunction(
  {
    id: 'reconcile-data',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"reconcile-data"' },
    onFailure: async ({ error }) => {
      logger.error(`[Reconcile] Function failed: ${error.message}`);
      await alertDiscord(
        'Reconciliation function failed',
        `Error: ${error.message}\n\nBlockfrost cross-reference checks are not running. Check BLOCKFROST_PROJECT_ID env var and Blockfrost service status.`,
      ).catch(() => {});
    },
    triggers: { cron: '0 */6 * * *' },
  },
  async ({ step }) => {
    // Step 1: Check if Blockfrost is configured
    const available = await step.run('check-availability', async () => {
      return isAvailable();
    });

    if (!available) {
      logger.warn('[Reconcile] Blockfrost not configured or unreachable, skipping');
      return { skipped: true, reason: 'blockfrost_unavailable' };
    }

    // Step 2: Run Tier 2 reconciliation
    const report = await step.run('run-reconciliation', async () => {
      return runReconciliation({ tier1: false, tier2: true });
    });

    const { surfaced, suppressed } = partitionMismatches(report.mismatches);
    const effectiveStatus = effectiveStatusAfterSuppression(surfaced);

    // Step 3: Store results
    await step.run('store-results', async () => {
      const supabase = getSupabaseAdmin();
      await supabase.from('reconciliation_log').insert({
        checked_at: report.checkedAt,
        source: report.source,
        tier_scope: 'tier2',
        results: report.results,
        overall_status: report.overallStatus,
        mismatches: report.mismatches.length > 0 ? report.mismatches : null,
        duration_ms: report.durationMs,
        metadata: {
          checkCount: report.results.length,
          mismatchCount: report.mismatches.length,
          surfacedMismatchCount: surfaced.length,
          suppressedMismatchCount: suppressed.length,
          suppressedMetrics: suppressed.map((m) => m.metric),
        },
      });

      // Also log to sync_log for unified monitoring
      await supabase.from('sync_log').insert(buildReconciliationSyncLogEntry(report, 'tier2'));
    });

    // Step 4: Alert on issues
    if (effectiveStatus !== 'match') {
      await step.run('alert-discrepancies', async () => {
        const mismatchSummary = surfaced
          .map((m) => `• ${m.metric}: ${m.status.toUpperCase()} — ${m.detail || 'no detail'}`)
          .join('\n');

        const title =
          effectiveStatus === 'mismatch'
            ? '🚨 Data MISMATCH detected — Blockfrost cross-reference'
            : '⚠️ Data drift detected — Blockfrost cross-reference';

        const suppressedNote = suppressed.length
          ? `\n(Also suppressed ${suppressed.length} known persistent mismatch(es): ${suppressed.map((m) => m.metric).join(', ')} — see lib/reconciliation/alert-suppressions.ts)`
          : '';

        const details = [
          `Status: ${effectiveStatus.toUpperCase()}`,
          `Checks: ${report.results.length} total, ${surfaced.length} surfaced (${report.mismatches.length} raw)`,
          `Duration: ${report.durationMs}ms`,
          '',
          'Issues:',
          mismatchSummary,
          suppressedNote,
          '',
          effectiveStatus === 'mismatch'
            ? 'ACTION: GHI computation will show a cross-reference alert until this is resolved.'
            : 'INFO: Minor drift detected. May resolve on next sync cycle.',
        ].join('\n');

        if (effectiveStatus === 'mismatch') {
          await alertCritical(title, details);
        } else {
          await alertDiscord(title, details);
        }
      });
    }

    return {
      overallStatus: report.overallStatus,
      effectiveStatus,
      checks: report.results.length,
      mismatches: report.mismatches.length,
      surfacedMismatches: surfaced.length,
      suppressedMismatches: suppressed.length,
      durationMs: report.durationMs,
      tierScope: 'tier2',
    };
  },
);
