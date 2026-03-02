import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

interface BenchmarkRow {
  chain: string;
  period_label: string;
  participation_rate: number | null;
  delegate_count: number | null;
  proposal_count: number | null;
  proposal_throughput: number | null;
  avg_rationale_rate: number | null;
  governance_score: number | null;
  grade: string | null;
  fetched_at: string;
}

export async function GET() {
  try {
    const enabled = await getFeatureFlag('cross_chain_observatory');
    if (!enabled) {
      return NextResponse.json({ latest: {}, history: [], disabled: true }, { status: 200 });
    }

    const supabase = createClient();

    const { data: latest, error: latestErr } = await supabase
      .from('governance_benchmarks')
      .select('chain, period_label, participation_rate, delegate_count, proposal_count, proposal_throughput, avg_rationale_rate, governance_score, grade, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(3);

    if (latestErr) {
      console.error('[benchmarks] Latest fetch error:', latestErr.message);
      return NextResponse.json({ error: 'Failed to fetch benchmarks' }, { status: 500 });
    }

    const chains = ['cardano', 'ethereum', 'polkadot'] as const;
    const latestByChain: Record<string, BenchmarkRow | null> = {};
    for (const chain of chains) {
      latestByChain[chain] = (latest as BenchmarkRow[])?.find(r => r.chain === chain) ?? null;
    }

    const { data: history, error: historyErr } = await supabase
      .from('governance_benchmarks')
      .select('chain, period_label, governance_score, grade, fetched_at')
      .order('fetched_at', { ascending: true })
      .limit(60);

    if (historyErr) {
      console.error('[benchmarks] History fetch error:', historyErr.message);
    }

    const historyByChain: Record<string, { periodLabel: string; score: number | null; grade: string | null }[]> = {
      cardano: [],
      ethereum: [],
      polkadot: [],
    };

    if (history) {
      for (const row of history as { chain: string; period_label: string; governance_score: number | null; grade: string | null }[]) {
        if (historyByChain[row.chain]) {
          historyByChain[row.chain].push({
            periodLabel: row.period_label,
            score: row.governance_score,
            grade: row.grade,
          });
        }
      }
    }

    return NextResponse.json({
      benchmarks: latestByChain,
      history: historyByChain,
      updatedAt: latest?.[0]?.fetched_at ?? null,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[benchmarks] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
