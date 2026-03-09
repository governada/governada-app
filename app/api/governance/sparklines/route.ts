import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  const [participationResult, treasuryResult, decentralizationResult] = await Promise.all([
    supabase
      .from('governance_participation_snapshots')
      .select('epoch, participation_rate, rationale_rate')
      .order('epoch', { ascending: false })
      .limit(20),
    supabase
      .from('treasury_health_snapshots')
      .select('epoch, health_score, runway_months, burn_rate_per_epoch')
      .order('epoch', { ascending: false })
      .limit(20),
    supabase
      .from('decentralization_snapshots')
      .select('epoch_no, composite_score, nakamoto_coefficient, active_drep_count')
      .order('epoch_no', { ascending: false })
      .limit(20),
  ]);

  // Reverse to ascending order for chart rendering (newest fetched first, displayed left-to-right)
  const participation = (participationResult.data ?? []).reverse();
  const treasury = (treasuryResult.data ?? []).reverse();
  const decentralization = (decentralizationResult.data ?? []).reverse();

  return NextResponse.json(
    { participation, treasury, decentralization },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
  );
});
