import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const poolId = request.nextUrl.pathname.split('/pools/')[1]?.split('/')[0];
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });
  const supabase = getSupabaseAdmin();

  const [snapshotsResult, poolResult] = await Promise.all([
    supabase
      .from('spo_power_snapshots')
      .select('epoch_no, live_stake_lovelace, delegator_count')
      .eq('pool_id', poolId)
      .order('epoch_no', { ascending: true })
      .limit(50),
    supabase.from('pools').select('delegator_count').eq('pool_id', poolId).single(),
  ]);

  const snapshots = (snapshotsResult.data || []).map(
    (s: { epoch_no: number; live_stake_lovelace: number; delegator_count: number }) => ({
      epoch: s.epoch_no,
      liveStakeAda: Math.round(Number(s.live_stake_lovelace) / 1_000_000),
      delegatorCount: s.delegator_count,
    }),
  );

  const currentDelegators = poolResult.data?.delegator_count ?? null;

  return NextResponse.json({ snapshots, currentDelegators });
});
