import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { computeTier } from '@/lib/scoring/tiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/pools/:poolId/summary
 * Returns full governance summary for a single pool:
 * score, participation, rationale rate, delegator count, claimed status, etc.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const poolId = request.nextUrl.pathname.split('/pools/')[1]?.split('/')[0];
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });

  const supabase = createClient();

  const { data: pool } = await supabase
    .from('pools')
    .select(
      'pool_id, ticker, pool_name, governance_score, vote_count, participation_pct, consistency_pct, reliability_pct, deliberation_pct, governance_identity_pct, confidence, delegator_count, live_stake_lovelace, claimed_by, score_momentum, current_tier, pool_status, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .eq('pool_id', poolId)
    .single();

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  const { data: snapshot } = await supabase
    .from('spo_score_snapshots')
    .select('governance_score, epoch_no')
    .eq('pool_id', poolId)
    .order('epoch_no', { ascending: false })
    .limit(2);

  let scoreDelta: number | null = null;
  if (snapshot && snapshot.length >= 2) {
    scoreDelta = (snapshot[0].governance_score ?? 0) - (snapshot[1].governance_score ?? 0);
  }

  const isClaimed = !!pool.claimed_by;
  const spoScore = pool.governance_score ?? 0;
  const tier = pool.current_tier ?? computeTier(spoScore);

  return NextResponse.json(
    {
      poolId: pool.pool_id,
      ticker: pool.ticker,
      name: pool.pool_name ?? pool.ticker ?? pool.pool_id,
      spoScore,
      score: spoScore,
      tier,
      isClaimed,
      claimedBy: pool.claimed_by ?? null,
      voteCount: pool.vote_count ?? 0,
      participationRate: pool.participation_pct ?? 0,
      deliberationQuality: pool.deliberation_pct ?? 0,
      reliabilityRate: pool.reliability_pct ?? 0,
      governanceIdentity: pool.governance_identity_pct ?? 0,
      confidence: pool.confidence ?? null,
      // V2 compat
      rationaleRate: pool.consistency_pct ?? 0,
      delegatorCount: pool.delegator_count ?? 0,
      liveStakeAda: pool.live_stake_lovelace
        ? Math.round(Number(pool.live_stake_lovelace) / 1_000_000)
        : 0,
      scoreDelta,
      momentum: pool.score_momentum ?? null,
      poolStatus: pool.pool_status ?? 'registered',
      alignment: {
        treasuryConservative: pool.alignment_treasury_conservative,
        treasuryGrowth: pool.alignment_treasury_growth,
        decentralization: pool.alignment_decentralization,
        security: pool.alignment_security,
        innovation: pool.alignment_innovation,
        transparency: pool.alignment_transparency,
      },
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=120' } },
  );
});
