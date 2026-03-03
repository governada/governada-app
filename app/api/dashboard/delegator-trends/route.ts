import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();

    const [snapshotsResult, drepResult] = await Promise.all([
      supabase
        .from('drep_power_snapshots')
        .select('epoch_no, amount_lovelace, delegator_count')
        .eq('drep_id', drepId)
        .order('epoch_no', { ascending: true })
        .limit(50),
      supabase.from('dreps').select('info').eq('id', drepId).single(),
    ]);

    const snapshots = (snapshotsResult.data || []).map((s: any) => ({
      epoch: s.epoch_no,
      votingPowerAda: Math.round(Number(s.amount_lovelace) / 1_000_000),
      delegatorCount: s.delegator_count,
    }));

    const currentDelegators = drepResult.data?.info?.delegatorCount || null;

    return NextResponse.json({ snapshots, currentDelegators });
  } catch (error) {
    console.error('[Delegator Trends API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
