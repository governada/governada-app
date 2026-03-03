import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();

    const { data: poolRows } = await supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, governance_score, vote_count, participation_pct, consistency_pct, reliability_pct, delegator_count, live_stake_lovelace, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .gt('vote_count', 0)
      .order('governance_score', { ascending: false, nullsFirst: false })
      .limit(200);

    if (poolRows?.length) {
      const pools = poolRows.map((p) => ({
        poolId: p.pool_id,
        ticker: p.ticker,
        poolName: p.pool_name,
        governanceScore: p.governance_score,
        voteCount: p.vote_count ?? 0,
        participationPct: p.participation_pct,
        consistencyPct: p.consistency_pct,
        reliabilityPct: p.reliability_pct,
        delegatorCount: p.delegator_count ?? 0,
        liveStakeAda: p.live_stake_lovelace
          ? Math.round(Number(p.live_stake_lovelace) / 1_000_000)
          : 0,
      }));

      return NextResponse.json(
        { pools },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
      );
    }

    // Fallback: no pools table data yet, aggregate from spo_votes
    const { data: votes } = await supabase.from('spo_votes').select('pool_id, vote');

    if (!votes?.length) {
      return NextResponse.json({ pools: [] });
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

    return NextResponse.json(
      { pools },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('[governance/pools] Error:', error);
    return NextResponse.json({ pools: [] }, { status: 500 });
  }
}
