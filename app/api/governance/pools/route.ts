import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { cached } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  const payload = await cached('governance:pools:list', 120, async () => {
    const { data: poolRows } = await supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, governance_score, vote_count, participation_pct, consistency_pct, reliability_pct, deliberation_pct, governance_identity_pct, confidence, current_tier, delegator_count, live_stake_lovelace, claimed_by, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, governance_statement, pool_status, score_momentum',
      )
      .gt('vote_count', 0)
      .order('governance_score', { ascending: false, nullsFirst: false });

    if (poolRows?.length) {
      const pools = poolRows.map((p) => ({
        poolId: p.pool_id,
        ticker: p.ticker,
        poolName: p.pool_name,
        governanceScore: p.governance_score,
        voteCount: p.vote_count ?? 0,
        participationPct: p.participation_pct,
        deliberationPct: p.deliberation_pct,
        reliabilityPct: p.reliability_pct,
        governanceIdentityPct: p.governance_identity_pct,
        confidence: p.confidence,
        tier: p.current_tier,
        // V2 compat
        consistencyPct: p.consistency_pct,
        delegatorCount: p.delegator_count ?? 0,
        liveStakeAda: p.live_stake_lovelace
          ? Math.round(Number(p.live_stake_lovelace) / 1_000_000)
          : 0,
        claimedBy: p.claimed_by ?? null,
        governanceStatement: p.governance_statement ?? null,
        poolStatus: p.pool_status ?? 'registered',
        scoreMomentum: p.score_momentum ?? null,
      }));
      return { pools };
    }

    // Fallback: no pools table data yet, aggregate from spo_votes
    const { data: votes } = await supabase.from('spo_votes').select('pool_id, vote');

    if (!votes?.length) {
      return { pools: [] };
    }

    const poolMap = new Map<string, { yes: number; no: number; abstain: number }>();
    for (const v of votes) {
      const existing = poolMap.get(v.pool_id) || { yes: 0, no: 0, abstain: 0 };
      if (v.vote === 'Yes') existing.yes++;
      else if (v.vote === 'No') existing.no++;
      else existing.abstain++;
      poolMap.set(v.pool_id, existing);
    }

    const pools = Array.from(poolMap.entries())
      .map(([poolId, counts]) => ({
        poolId,
        ticker: null,
        poolName: null,
        governanceScore: null,
        voteCount: counts.yes + counts.no + counts.abstain,
        participationPct: null,
        consistencyPct: null,
        reliabilityPct: null,
        delegatorCount: 0,
        liveStakeAda: 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    return { pools };
  });

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
  });
});
