import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

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
  raw_data: Record<string, unknown> | null;
  ai_insight: string | null;
  fetched_at: string;
}

export async function GET() {
  try {
    const supabase = createClient();

    const { data: latest, error: latestErr } = await supabase
      .from('governance_benchmarks')
      .select(
        'chain, period_label, participation_rate, delegate_count, proposal_count, proposal_throughput, avg_rationale_rate, governance_score, grade, raw_data, ai_insight, fetched_at',
      )
      .order('fetched_at', { ascending: false })
      .limit(3);

    if (latestErr) {
      console.error('[benchmarks] Latest fetch error:', latestErr.message);
      return NextResponse.json({ error: 'Failed to fetch benchmarks' }, { status: 500 });
    }

    const chains = ['cardano', 'ethereum', 'polkadot'] as const;
    const latestByChain: Record<string, BenchmarkRow | null> = {};
    for (const chain of chains) {
      latestByChain[chain] = (latest as BenchmarkRow[])?.find((r) => r.chain === chain) ?? null;
    }

    const aiInsight = (latest as BenchmarkRow[])?.find((r) => r.ai_insight)?.ai_insight ?? null;

    return NextResponse.json(
      {
        benchmarks: latestByChain,
        aiInsight,
        updatedAt: latest?.[0]?.fetched_at ?? null,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (err) {
    console.error('[benchmarks] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
