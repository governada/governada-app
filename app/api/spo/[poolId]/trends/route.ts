import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const [snapshotsResult, poolResult] = await Promise.all([
    supabase
      .from('spo_power_snapshots')
      .select('epoch_no, delegator_count, live_stake_lovelace')
      .eq('pool_id', poolId)
      .order('epoch_no', { ascending: true })
      .limit(20),
    supabase
      .from('pools')
      .select('delegator_count, live_stake_lovelace')
      .eq('pool_id', poolId)
      .single(),
  ]);

  const snapshots = (snapshotsResult.data || []).map(
    (s: {
      epoch_no: number;
      delegator_count: number | null;
      live_stake_lovelace: number | null;
    }) => ({
      epoch: s.epoch_no,
      delegatorCount: s.delegator_count,
      liveStakeAda:
        s.live_stake_lovelace != null
          ? Math.round(Number(s.live_stake_lovelace) / 1_000_000)
          : null,
    }),
  );

  const currentDelegators = poolResult.data?.delegator_count ?? null;
  const currentLiveStakeAda =
    poolResult.data?.live_stake_lovelace != null
      ? Math.round(Number(poolResult.data.live_stake_lovelace) / 1_000_000)
      : null;

  return NextResponse.json({ snapshots, currentDelegators, currentLiveStakeAda });
}
