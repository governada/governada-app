/**
 * Sync Freshness Guard — rapid self-healing cron.
 * Runs every 30 min, checks v_sync_health for stale syncs, and retriggers them
 * via Inngest events (durable, no HTTP round-trip vulnerability).
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { alertDiscord, alertCritical, emitPostHog, type SyncType } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

const FRESHNESS_THRESHOLDS: Record<string, { mins: number; event: string }> = {
  proposals: { mins: 90, event: 'drepscore/sync.proposals' },
  dreps: { mins: 480, event: 'drepscore/sync.dreps' },
  votes: { mins: 480, event: 'drepscore/sync.votes' },
  secondary: { mins: 480, event: 'drepscore/sync.secondary' },
  slow: { mins: 1800, event: 'drepscore/sync.slow' },
  treasury: { mins: 1500, event: 'drepscore/sync.treasury' },
  scoring: { mins: 480, event: 'drepscore/sync.scores' },
  alignment: { mins: 480, event: 'drepscore/sync.alignment' },
  ghi: { mins: 1500, event: 'drepscore/sync.ghi' },
  benchmarks: { mins: 11520, event: 'drepscore/sync.benchmarks' },
  spo_votes: { mins: 480, event: 'drepscore/sync.spo-votes' },
  cc_votes: { mins: 480, event: 'drepscore/sync.cc-votes' },
  epoch_recaps: { mins: 8640, event: 'drepscore/sync.epoch-recaps' },
  spo_scores: { mins: 1500, event: 'drepscore/sync.spo-scores' },
  governance_epoch_stats: { mins: 1500, event: 'drepscore/sync.governance-epoch-stats' },
  data_moat: { mins: 1500, event: 'drepscore/sync.data-moat' },
  catalyst: { mins: 1500, event: 'drepscore/sync.catalyst' },
};

const RECENT_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const GHOST_THRESHOLD_MS = 30 * 60 * 1000;
/** Entries older than 24h with finished_at IS NULL are definitely abandoned */
const HISTORICAL_GHOST_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const SELF_HEAL_MAX_TRIGGERS = 3;
const SELF_HEAL_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Any sync_log entry with duration > 4h is a metric anomaly (likely onFailure delay) */
const MAX_REASONABLE_DURATION_MS = 4 * 60 * 60 * 1000;

export const syncFreshnessGuard = inngest.createFunction(
  {
    id: 'sync-freshness-guard',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"freshness-guard"' },
  },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const recoveries: string[] = [];

    await step.run('cleanup-ghost-entries', async () => {
      const supabase = getSupabaseAdmin();
      const cutoff = new Date(Date.now() - GHOST_THRESHOLD_MS).toISOString();
      const { data: ghosts } = await supabase
        .from('sync_log')
        .select('id, sync_type, started_at')
        .eq('success', false)
        .is('error_message', null)
        .is('duration_ms', null)
        .lt('started_at', cutoff);

      if (!ghosts || ghosts.length === 0) return 0;

      for (const ghost of ghosts) {
        await supabase
          .from('sync_log')
          .update({
            error_message: 'Process terminated (likely deployment restart)',
            duration_ms: 0,
          })
          .eq('id', ghost.id);
      }
      logger.info('[FreshnessGuard] Cleaned up ghost sync_log entries', { count: ghosts.length });
      return ghosts.length;
    });

    // Clean historical ghosts: entries older than 24h with finished_at IS NULL.
    // These are pre-existing abandoned entries from before the freshness guard
    // was deployed, or from rare edge cases where the process never completed.
    await step.run('cleanup-historical-ghosts', async () => {
      const supabase = getSupabaseAdmin();
      const cutoff = new Date(Date.now() - HISTORICAL_GHOST_THRESHOLD_MS).toISOString();
      const { data: ghosts } = await supabase
        .from('sync_log')
        .select('id, sync_type, started_at')
        .is('finished_at', null)
        .lt('started_at', cutoff);

      if (!ghosts || ghosts.length === 0) return 0;

      for (const ghost of ghosts) {
        await supabase
          .from('sync_log')
          .update({
            finished_at: new Date().toISOString(),
            success: false,
            error_message: 'Historical ghost: process never completed (cleaned by freshness guard)',
            duration_ms: 0,
          })
          .eq('id', ghost.id);
      }
      logger.info('[FreshnessGuard] Cleaned up historical ghost entries', {
        count: ghosts.length,
        ids: ghosts.map((g) => g.id),
      });
      return ghosts.length;
    });

    // Clean duration anomalies: entries where duration_ms > 4h.
    // These are typically caused by onFailure handlers running hours after the sync
    // started (due to Inngest retries + backoff), producing misleading duration metrics.
    await step.run('cleanup-duration-anomalies', async () => {
      const supabase = getSupabaseAdmin();
      const { data: anomalies } = await supabase
        .from('sync_log')
        .select('id, sync_type, duration_ms')
        .not('finished_at', 'is', null)
        .not('started_at', 'is', null)
        .gt('duration_ms', MAX_REASONABLE_DURATION_MS);

      if (!anomalies || anomalies.length === 0) return 0;

      for (const entry of anomalies) {
        await supabase
          .from('sync_log')
          .update({
            duration_ms: 0,
            error_message: `Duration anomaly corrected by freshness guard (original: ${Math.round((entry.duration_ms ?? 0) / 60_000)}min — likely onFailure handler delay)`,
          })
          .eq('id', entry.id);
      }
      logger.info('[FreshnessGuard] Corrected duration anomalies', {
        count: anomalies.length,
      });
      return anomalies.length;
    });

    const staleTypes = await step.run('check-freshness', async () => {
      const supabase = getSupabaseAdmin();
      const { data: rows } = await supabase.from('v_sync_health').select('*');
      if (!rows) return [];

      const now = Date.now();
      const stale: { syncType: string; staleMins: number; event: string }[] = [];

      for (const row of rows) {
        const config = FRESHNESS_THRESHOLDS[row.sync_type];
        if (!config) continue;
        if (!row.last_run) {
          stale.push({ syncType: row.sync_type, staleMins: Infinity, event: config.event });
          continue;
        }

        const staleMins = Math.round((now - new Date(row.last_run).getTime()) / 60_000);
        if (staleMins > config.mins) {
          stale.push({ syncType: row.sync_type, staleMins, event: config.event });
        }
      }

      return stale;
    });

    // ── Epoch-gap detection for snapshot tables ──
    // Catches cases where the daily GHI/treasury sync ran before an epoch boundary,
    // leaving the new epoch without a snapshot until the next scheduled run.
    const epochGaps = await step.run('check-epoch-gaps', async () => {
      const supabase = getSupabaseAdmin();
      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = stats?.current_epoch ?? 0;
      if (currentEpoch === 0) return [];

      const gaps: { syncType: string; event: string; epoch: number }[] = [];

      const snapshotChecks: { table: string; epochCol: string; syncType: string; event: string }[] =
        [
          {
            table: 'ghi_snapshots',
            epochCol: 'epoch_no',
            syncType: 'ghi',
            event: 'drepscore/sync.ghi',
          },
          {
            table: 'treasury_snapshots',
            epochCol: 'epoch_no',
            syncType: 'treasury',
            event: 'drepscore/sync.treasury',
          },
        ];

      for (const check of snapshotChecks) {
        const { count } = await supabase
          .from(check.table)
          .select('*', { count: 'exact', head: true })
          .eq(check.epochCol, currentEpoch);

        if ((count ?? 0) === 0) {
          gaps.push({ syncType: check.syncType, event: check.event, epoch: currentEpoch });
        }
      }

      return gaps;
    });

    for (const gap of epochGaps) {
      await step.run(`recover-epoch-gap-${gap.syncType}`, async () => {
        logger.info('[FreshnessGuard] Epoch gap detected — triggering sync', {
          syncType: gap.syncType,
          missingEpoch: gap.epoch,
        });
        await inngest.send({ name: gap.event });

        emitPostHog(true, gap.syncType as SyncType, 0, {
          event_override: 'sync_epoch_gap_healed',
          missing_epoch: gap.epoch,
        });
        await alertDiscord(
          `Epoch Gap Healed: ${gap.syncType}`,
          `No epoch ${gap.epoch} snapshot found. Triggered sync via freshness guard.`,
        );
        recoveries.push(`${gap.syncType}: epoch ${gap.epoch} gap`);
      });
    }

    if (staleTypes.length === 0 && epochGaps.length === 0) {
      return { recovered: 0, message: 'All syncs fresh' };
    }

    for (const { syncType, staleMins, event } of staleTypes) {
      const recovered = await step.run(`recover-${syncType}`, async () => {
        const supabase = getSupabaseAdmin();

        const { data: recentFail } = await supabase
          .from('sync_log')
          .select('id')
          .eq('sync_type', syncType)
          .eq('success', false)
          .gte('started_at', new Date(Date.now() - RECENT_FAILURE_WINDOW_MS).toISOString())
          .limit(1)
          .single();

        if (recentFail) {
          logger.info('[FreshnessGuard] Skipping — recent failure within 15m', { syncType });
          return null;
        }

        const { count: recentTriggerCount } = await supabase
          .from('sync_log')
          .select('id', { count: 'exact', head: true })
          .eq('sync_type', syncType)
          .gte('started_at', new Date(Date.now() - SELF_HEAL_WINDOW_MS).toISOString());

        if ((recentTriggerCount ?? 0) >= SELF_HEAL_MAX_TRIGGERS) {
          logger.info('[FreshnessGuard] Throttling — too many recent runs', {
            syncType,
            recentTriggerCount,
            max: SELF_HEAL_MAX_TRIGGERS,
          });
          await alertCritical(
            `Self-Heal Throttled: ${syncType}`,
            `${recentTriggerCount} runs in last 2h but still stale (${staleMins}m). Possible persistent failure — needs manual investigation.`,
          );
          return null;
        }

        logger.info('[FreshnessGuard] Retriggering stale sync via Inngest event', {
          syncType,
          staleMins,
        });
        await inngest.send({ name: event });

        emitPostHog(true, syncType as SyncType, 0, {
          event_override: 'sync_self_healed',
          staleness_minutes: staleMins,
        });
        await alertDiscord(
          `Self-Healed: ${syncType}`,
          `Sync was ${staleMins}m stale. Retriggered via freshness guard (Inngest event).`,
        );
        return { syncType, staleMins };
      });

      if (recovered) {
        recoveries.push(`${recovered.syncType}: ${recovered.staleMins}m stale`);
      }
    }

    return { recovered: recoveries.length, details: recoveries };
  },
);
