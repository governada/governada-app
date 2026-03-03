import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ApiContext } from '@/lib/api/handler';

async function handler(_request: NextRequest, ctx: ApiContext) {
  const supabase = getSupabaseAdmin();

  const [snapshotResult, healthResult, pendingResult] = await Promise.all([
    supabase
      .from('treasury_snapshots')
      .select(
        'epoch_no, balance_lovelace, withdrawals_lovelace, reserves_income_lovelace, snapshot_at',
      )
      .order('epoch_no', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('treasury_health_snapshots')
      .select(
        'epoch, health_score, balance_trend, withdrawal_velocity, income_stability, pending_load, runway_adequacy, runway_months, burn_rate_per_epoch, pending_count, pending_total_ada',
      )
      .order('epoch', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .eq('proposal_type', 'TreasuryWithdrawals')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('expired_epoch', null)
      .is('dropped_epoch', null),
  ]);

  const snap = snapshotResult.data;
  const health = healthResult.data;

  const treasury = {
    balance: snap
      ? {
          epoch: snap.epoch_no,
          balance_lovelace: snap.balance_lovelace,
          withdrawals_lovelace: snap.withdrawals_lovelace,
          reserves_income_lovelace: snap.reserves_income_lovelace,
          snapshot_at: snap.snapshot_at,
        }
      : null,
    health: health
      ? {
          epoch: health.epoch,
          health_score: health.health_score,
          components: {
            balance_trend: health.balance_trend,
            withdrawal_velocity: health.withdrawal_velocity,
            income_stability: health.income_stability,
            pending_load: health.pending_load,
            runway_adequacy: health.runway_adequacy,
          },
          runway_months: health.runway_months,
          burn_rate_per_epoch: health.burn_rate_per_epoch,
        }
      : null,
    pending_treasury_proposals: pendingResult.count ?? 0,
  };

  return apiSuccess(treasury, {
    requestId: ctx.requestId,
    cacheSeconds: 900,
    dataCachedAt: snap?.snapshot_at ? new Date(snap.snapshot_at) : undefined,
  });
}

export const GET = withApiHandler(handler);
export const dynamic = 'force-dynamic';
