/**
 * Data Reconciliation — Inngest cron function.
 *
 * Cross-references Governada's Supabase data against Blockfrost's
 * independent Cardano db-sync to detect discrepancies.
 *
 * Schedule:
 *   Tier 1 — every 2 hours (DRep/proposal counts, CC, epoch, treasury)
 *   Tier 2 — every 6 hours (per-proposal votes, DRep power spot-checks)
 *
 * This function runs Tier 1 every invocation and Tier 2 every 3rd
 * invocation (2h × 3 = 6h).
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { alertDiscord, alertCritical } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import { runReconciliation } from '@/lib/reconciliation/comparator';
import { isAvailable } from '@/lib/reconciliation/blockfrost';
import { buildReconciliationSyncLogEntry } from '@/lib/reconciliation/sync-log';

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
    triggers: { cron: '45 */2 * * *' }, // Every 2 hours at :45 (well offset from Koios-heavy syncs)
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

    // Step 2: Determine if we should run Tier 2 this cycle
    const runTier2 = await step.run('check-tier2-schedule', async () => {
      const supabase = getSupabaseAdmin();
      // Count how many reconciliation runs happened in the last 6 hours
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('reconciliation_log')
        .select('id', { count: 'exact', head: true })
        .gte('checked_at', sixHoursAgo)
        .eq('tier_scope', 'tier1+tier2');
      // Run Tier 2 if no full run in the last 6 hours
      return (count ?? 0) === 0;
    });

    // Step 3: Run reconciliation
    const report = await step.run('run-reconciliation', async () => {
      return runReconciliation({ tier1: true, tier2: runTier2 });
    });

    // Step 4: Store results
    await step.run('store-results', async () => {
      const supabase = getSupabaseAdmin();
      await supabase.from('reconciliation_log').insert({
        checked_at: report.checkedAt,
        source: report.source,
        tier_scope: runTier2 ? 'tier1+tier2' : 'tier1',
        results: report.results,
        overall_status: report.overallStatus,
        mismatches: report.mismatches.length > 0 ? report.mismatches : null,
        duration_ms: report.durationMs,
        metadata: { checkCount: report.results.length, mismatchCount: report.mismatches.length },
      });

      // Also log to sync_log for unified monitoring
      await supabase.from('sync_log').insert(buildReconciliationSyncLogEntry(report, runTier2));
    });

    // Step 5: Alert on issues
    if (report.overallStatus !== 'match') {
      await step.run('alert-discrepancies', async () => {
        const mismatchSummary = report.mismatches
          .map((m) => `• ${m.metric}: ${m.status.toUpperCase()} — ${m.detail || 'no detail'}`)
          .join('\n');

        const title =
          report.overallStatus === 'mismatch'
            ? '🚨 Data MISMATCH detected — Blockfrost cross-reference'
            : '⚠️ Data drift detected — Blockfrost cross-reference';

        const details = [
          `Status: ${report.overallStatus.toUpperCase()}`,
          `Checks: ${report.results.length} total, ${report.mismatches.length} issues`,
          `Duration: ${report.durationMs}ms`,
          '',
          'Issues:',
          mismatchSummary,
          '',
          report.overallStatus === 'mismatch'
            ? 'ACTION: GHI computation will show a cross-reference alert until this is resolved.'
            : 'INFO: Minor drift detected. May resolve on next sync cycle.',
        ].join('\n');

        if (report.overallStatus === 'mismatch') {
          await alertCritical(title, details);
        } else {
          await alertDiscord(title, details);
        }
      });
    }

    return {
      overallStatus: report.overallStatus,
      checks: report.results.length,
      mismatches: report.mismatches.length,
      durationMs: report.durationMs,
      tierScope: runTier2 ? 'tier1+tier2' : 'tier1',
    };
  },
);
