/**
 * Treasury Snapshot Sync — runs daily at 22:30 UTC.
 * Fetches current treasury balance from Koios /totals and stores epoch-level snapshots.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchTreasuryBalance } from '@/utils/koios';
import { calculateTreasuryHealthScore } from '@/lib/treasury';
import { SyncLogger, emitPostHog, errMsg, capMsg, pingHeartbeat } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

export const syncTreasurySnapshot = inngest.createFunction(
  {
    id: 'sync-treasury-snapshot',
    retries: 3,
    concurrency: { limit: 1, scope: 'env', key: '"treasury-sync"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[treasury] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'treasury')
        .is('finished_at', null);
    },
  },
  [{ cron: '30 22 * * *' }, { event: 'drepscore/sync.treasury' }],
  async ({ step }) => {
    let snapshotEpoch = 0;
    let errorMessage: string | null = null;

    // Idempotency guard: skip if another treasury sync is already in progress
    const alreadyRunning = await step.run('check-idempotency', async () => {
      const sb = getSupabaseAdmin();
      const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min window
      const { data } = await sb
        .from('sync_log')
        .select('id')
        .eq('sync_type', 'treasury')
        .eq('success', false)
        .is('finished_at', null)
        .gte('started_at', cutoff)
        .limit(1);
      return (data?.length ?? 0) > 0;
    });

    if (alreadyRunning) {
      logger.info('[treasury] Skipping — another treasury sync is already in progress');
      return { skipped: true, reason: 'concurrent run detected' };
    }

    const logId = await step.run('init-sync-log', async () => {
      const sb = getSupabaseAdmin();
      const sl = new SyncLogger(sb, 'treasury');
      await sl.start();
      return sl.id;
    });

    const supabase = getSupabaseAdmin();
    const syncLog = new SyncLogger(supabase, 'treasury', logId);

    try {
      const snapshot = await step.run('fetch-treasury-balance', async () => {
        const treasury = await fetchTreasuryBalance();
        return {
          epoch: treasury.epoch,
          balanceLovelace: treasury.balance.toString(),
          reservesLovelace: treasury.reserves.toString(),
        };
      });

      snapshotEpoch = snapshot.epoch;

      const withdrawals = await step.run('calculate-epoch-withdrawals', async () => {
        const sb = getSupabaseAdmin();
        const { data } = await sb
          .from('proposals')
          .select('withdrawal_amount')
          .eq('proposal_type', 'TreasuryWithdrawals')
          .eq('enacted_epoch', snapshot.epoch);

        const total = (data || []).reduce(
          (sum, p) => sum + BigInt(p.withdrawal_amount || 0) * BigInt(1_000_000),
          BigInt(0),
        );
        return total.toString();
      });

      const prevSnapshot = await step.run('calculate-income', async () => {
        const sb = getSupabaseAdmin();
        const { data } = await sb
          .from('treasury_snapshots')
          .select('balance_lovelace, epoch_no')
          .eq('epoch_no', snapshot.epoch - 1)
          .single();

        return data;
      });

      const reservesIncome = prevSnapshot
        ? (
            BigInt(snapshot.balanceLovelace) -
            BigInt(prevSnapshot.balance_lovelace) +
            BigInt(withdrawals)
          ).toString()
        : '0';

      await step.run('upsert-snapshot', async () => {
        const sb = getSupabaseAdmin();
        const { error } = await sb.from('treasury_snapshots').upsert(
          {
            epoch_no: snapshot.epoch,
            balance_lovelace: snapshot.balanceLovelace,
            reserves_lovelace: snapshot.reservesLovelace,
            withdrawals_lovelace: withdrawals,
            reserves_income_lovelace: reservesIncome,
            snapshot_at: new Date().toISOString(),
          },
          { onConflict: 'epoch_no' },
        );

        if (error) throw new Error(`Treasury snapshot upsert failed: ${error.message}`);
      });

      const healthResult = await step.run('snapshot-treasury-health', async () => {
        try {
          const sb = getSupabaseAdmin();
          const { data: existing } = await sb
            .from('treasury_health_snapshots')
            .select('epoch')
            .eq('epoch', snapshot.epoch)
            .maybeSingle();
          if (existing) return { skipped: true, epoch: snapshot.epoch };

          const health = await calculateTreasuryHealthScore();
          if (!health) return { skipped: true, reason: 'insufficient data' };

          const pendingSb = getSupabaseAdmin();
          const { data: pendingData } = await pendingSb
            .from('proposals')
            .select('withdrawal_amount')
            .eq('proposal_type', 'TreasuryWithdrawals')
            .is('ratified_epoch', null)
            .is('enacted_epoch', null)
            .is('expired_epoch', null)
            .is('dropped_epoch', null);

          const pendingCount = pendingData?.length ?? 0;
          const pendingTotalAda = (pendingData || []).reduce(
            (sum, p) => sum + (p.withdrawal_amount || 0),
            0,
          );

          const { error } = await sb.from('treasury_health_snapshots').insert({
            epoch: snapshot.epoch,
            health_score: health.score,
            balance_trend: health.components.balanceTrend,
            withdrawal_velocity: health.components.withdrawalVelocity,
            income_stability: health.components.incomeStability,
            pending_load: health.components.pendingLoad,
            runway_adequacy: health.components.runwayAdequacy,
            runway_months: health.runwayMonths,
            burn_rate_per_epoch: health.burnRatePerEpoch,
            pending_count: pendingCount,
            pending_total_ada: pendingTotalAda,
          });

          if (error) throw new Error(error.message);

          await sb.from('snapshot_completeness_log').upsert(
            {
              snapshot_type: 'treasury_health',
              epoch_no: snapshot.epoch,
              snapshot_date: new Date().toISOString().slice(0, 10),
              record_count: 1,
              expected_count: 1,
              coverage_pct: 100,
              metadata: { health_score: health.score },
            },
            { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
          );

          logger.info('[treasury] Health snapshot stored', {
            score: health.score,
            runwayMonths: health.runwayMonths,
            epoch: snapshot.epoch,
          });
          return { inserted: true, epoch: snapshot.epoch, healthScore: health.score };
        } catch (err) {
          logger.error('[treasury] Health snapshot failed', { error: err });
          return { error: errMsg(err) };
        }
      });

      await syncLog.finalize(true, null, {
        epoch: snapshot.epoch,
        balance_lovelace: snapshot.balanceLovelace,
        withdrawals_lovelace: withdrawals,
        reserves_income_lovelace: reservesIncome,
        health_snapshot: healthResult,
      });
      await emitPostHog(true, 'treasury', syncLog.elapsed, { epoch: snapshot.epoch });
      await pingHeartbeat('HEARTBEAT_URL_DAILY');

      await step.run('heartbeat-daily', () => pingHeartbeat('HEARTBEAT_URL_DAILY'));

      return { epoch: snapshot.epoch, balance: snapshot.balanceLovelace, health: healthResult };
    } catch (e) {
      errorMessage = errMsg(e);
      await syncLog.finalize(false, errorMessage, { epoch: snapshotEpoch });
      await emitPostHog(false, 'treasury', syncLog.elapsed, { epoch: snapshotEpoch });
      throw e;
    }
  },
);
