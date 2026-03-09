import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { computeTier } from '@/lib/scoring/tiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/pools/:poolId/competitive
 * Returns competitive context: rank, nearby competitors, trend.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const poolId = request.nextUrl.pathname.split('/pools/')[1]?.split('/')[0];
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });
  const supabase = createClient();

  const { data: pool } = await supabase
    .from('pools')
    .select(
      'pool_id, ticker, pool_name, governance_score, vote_count, current_tier, score_momentum, claimed_by',
    )
    .eq('pool_id', poolId)
    .single();

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  const { data: allPools } = await supabase
    .from('pools')
    .select('pool_id, ticker, pool_name, governance_score, vote_count')
    .gt('vote_count', 0)
    .order('governance_score', { ascending: false, nullsFirst: false });

  if (!allPools?.length) {
    return NextResponse.json({
      pool,
      rank: 1,
      totalPools: 1,
      percentile: 100,
      neighbors: [],
    });
  }

  const idx = allPools.findIndex((p) => p.pool_id === poolId);
  const rank = idx >= 0 ? idx + 1 : allPools.length;
  const percentile = Math.round(((allPools.length - rank) / allPools.length) * 100);

  const startIdx = Math.max(0, idx - 2);
  const endIdx = Math.min(allPools.length, idx + 3);
  const neighbors = allPools.slice(startIdx, endIdx).map((p, i) => ({
    poolId: p.pool_id,
    ticker: p.ticker,
    poolName: p.pool_name,
    score: p.governance_score,
    rank: startIdx + i + 1,
    isTarget: p.pool_id === poolId,
    tier: computeTier(p.governance_score ?? 0),
  }));

  const { data: history } = await supabase
    .from('spo_score_snapshots')
    .select('epoch_no, governance_score')
    .eq('pool_id', poolId)
    .order('epoch_no', { ascending: false })
    .limit(10);

  return NextResponse.json({
    pool: {
      ...pool,
      tier: pool.current_tier ?? computeTier(pool.governance_score ?? 0),
    },
    rank,
    totalPools: allPools.length,
    percentile,
    neighbors,
    scoreHistory: history ?? [],
    momentum: pool.score_momentum,
  });
});
