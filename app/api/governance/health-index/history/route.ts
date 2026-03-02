import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { computeGHI, type GHIResult } from '@/lib/ghi';

export async function GET(request: NextRequest) {
  try {
    const epochs = Math.min(
      parseInt(request.nextUrl.searchParams.get('epochs') ?? '20', 10),
      50,
    );

    const supabase = createClient();
    const { data: snapshots } = await supabase
      .from('ghi_snapshots')
      .select('epoch_no, score, band, components')
      .order('epoch_no', { ascending: false })
      .limit(epochs);

    const current = await computeGHI();

    const history = (snapshots ?? []).map(s => ({
      epoch: s.epoch_no,
      score: Number(s.score),
      band: s.band as string,
    }));

    let trend: { direction: 'up' | 'down' | 'flat'; delta: number; streakEpochs: number } = {
      direction: 'flat',
      delta: 0,
      streakEpochs: 0,
    };

    if (history.length >= 2) {
      const delta = current.score - history[0].score;
      trend.delta = Math.round(delta * 10) / 10;
      trend.direction = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat';

      let streak = 0;
      for (let i = 0; i < history.length - 1; i++) {
        const d = history[i].score - history[i + 1].score;
        if ((trend.direction === 'up' && d > 0) || (trend.direction === 'down' && d < 0)) {
          streak++;
        } else {
          break;
        }
      }
      trend.streakEpochs = streak;
    }

    return NextResponse.json(
      { current, history, trend } satisfies {
        current: GHIResult;
        history: { epoch: number; score: number; band: string }[];
        trend: { direction: string; delta: number; streakEpochs: number };
      },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('[GHI History] Failed:', error);
    return NextResponse.json({ error: 'Failed to fetch GHI history' }, { status: 500 });
  }
}
