/**
 * Treasury Snapshot Sync — runs daily at 22:30 UTC.
 * Fetches current treasury balance from Koios /totals and stores epoch-level snapshots.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchTreasuryBalance } from '@/utils/koios';
import { SyncLogger, emitPostHog, errMsg, pingHeartbeat } from '@/lib/sync-utils';

export const syncTreasurySnapshot = inngest.createFunction(
  {
    id: 'sync-treasury-snapshot',
    retries: 3,
    concurrency: { limit: 1, scope: 'env', key: '"treasury-sync"' },
  },
  [{ cron: '30 22 * * *' }, { event: 'drepscore/sync.treasury' }],
  async ({ step }) => {
    const supabase = getSupabaseAdmin();
    const logger = new SyncLogger(supabase, 'treasury');
    await logger.start();

    let snapshotEpoch = 0;
    let errorMessage: string | null = null;

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
        ? (BigInt(snapshot.balanceLovelace) - BigInt(prevSnapshot.balance_lovelace) + BigInt(withdrawals)).toString()
        : '0';

      await step.run('upsert-snapshot', async () => {
        const sb = getSupabaseAdmin();
        const { error } = await sb
          .from('treasury_snapshots')
          .upsert({
            epoch_no: snapshot.epoch,
            balance_lovelace: snapshot.balanceLovelace,
            reserves_lovelace: snapshot.reservesLovelace,
            withdrawals_lovelace: withdrawals,
            reserves_income_lovelace: reservesIncome,
            snapshot_at: new Date().toISOString(),
          }, { onConflict: 'epoch_no' });

        if (error) throw new Error(`Treasury snapshot upsert failed: ${error.message}`);
      });

      await logger.finalize(true, null, {
        epoch: snapshot.epoch,
        balance_lovelace: snapshot.balanceLovelace,
        withdrawals_lovelace: withdrawals,
        reserves_income_lovelace: reservesIncome,
      });
      await emitPostHog(true, 'treasury', logger.elapsed, { epoch: snapshot.epoch });
      await pingHeartbeat('HEARTBEAT_URL_DAILY');

      await step.run('heartbeat-daily', () =>
        pingHeartbeat('HEARTBEAT_URL_DAILY')
      );

      return { epoch: snapshot.epoch, balance: snapshot.balanceLovelace };
    } catch (e) {
      errorMessage = errMsg(e);
      await logger.finalize(false, errorMessage, { epoch: snapshotEpoch });
      await emitPostHog(false, 'treasury', logger.elapsed, { epoch: snapshotEpoch });
      throw e;
    }
  },
);
