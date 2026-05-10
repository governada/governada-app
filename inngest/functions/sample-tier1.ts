/**
 * Tier 1 Reconciliation Sampling — Inngest cron function.
 *
 * Runs the cheap Blockfrost cross-reference checks every 5 minutes so
 * Governada detects user-visible source drift quickly.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { alertDiscord, alertCritical, pingHeartbeat } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';
import { runReconciliation } from '@/lib/reconciliation/comparator';
import { isAvailable } from '@/lib/reconciliation/blockfrost';
import { buildReconciliationSyncLogEntry } from '@/lib/reconciliation/sync-log';

export const sampleTier1 = inngest.createFunction(
  {
    id: 'sample-tier1',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"sample-tier1"' },
    onFailure: async ({ error }) => {
      logger.error(`[SampleTier1] Function failed: ${error.message}`);
      await alertDiscord(
        'Tier 1 sampling function failed',
        `Error: ${error.message}\n\nBlockfrost Tier 1 cross-reference checks are not running. Check BLOCKFROST_PROJECT_ID env var and Blockfrost service status.`,
      ).catch(() => {});
    },
    triggers: { cron: '*/5 * * * *' },
  },
  async ({ step }) => {
    const available = await step.run('check-availability', async () => {
      return isAvailable();
    });

    if (!available) {
      logger.warn('[SampleTier1] Blockfrost not configured or unreachable, skipping');
      return { skipped: true, reason: 'blockfrost_unavailable' };
    }

    const report = await step.run('run-reconciliation', async () => {
      return runReconciliation({ tier1: true, tier2: false });
    });

    await step.run('store-results', async () => {
      const supabase = getSupabaseAdmin();
      await supabase.from('reconciliation_log').insert({
        checked_at: report.checkedAt,
        source: report.source,
        tier_scope: 'tier1_sample',
        results: report.results,
        overall_status: report.overallStatus,
        mismatches: report.mismatches.length > 0 ? report.mismatches : null,
        duration_ms: report.durationMs,
        metadata: { checkCount: report.results.length, mismatchCount: report.mismatches.length },
      });

      await supabase
        .from('sync_log')
        .insert(buildReconciliationSyncLogEntry(report, 'tier1_sample'));
    });

    if (report.overallStatus !== 'match') {
      await step.run('alert-discrepancies', async () => {
        const mismatchSummary = report.mismatches
          .map((m) => `• ${m.metric}: ${m.status.toUpperCase()} — ${m.detail || 'no detail'}`)
          .join('\n');

        const title =
          report.overallStatus === 'mismatch'
            ? '🚨 Tier 1 data MISMATCH detected — Blockfrost cross-reference'
            : '⚠️ Tier 1 data drift detected — Blockfrost cross-reference';

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

    await step.run('heartbeat-sample-tier1', () => pingHeartbeat('HEARTBEAT_URL_SAMPLE_TIER1'));

    return {
      overallStatus: report.overallStatus,
      checks: report.results.length,
      mismatches: report.mismatches.length,
      durationMs: report.durationMs,
      tierScope: 'tier1_sample',
    };
  },
);
