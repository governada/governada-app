export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { computeGHI, type GHIResult } from '@/lib/ghi';
import { GHI_CALIBRATION } from '@/lib/scoring/calibration';

export const GET = withRouteHandler(
  async (request) => {
    const epochs = Math.min(parseInt(request.nextUrl.searchParams.get('epochs') ?? '20', 10), 50);

    const supabase = createClient();
    const { data: snapshots } = await supabase
      .from('ghi_snapshots')
      .select('epoch_no, score, band, components')
      .order('epoch_no', { ascending: false })
      .limit(epochs);

    const current = await computeGHI();

    const history = (snapshots ?? []).map((s) => ({
      epoch: s.epoch_no,
      score: Number(s.score),
      band: s.band as string,
      components:
        (s.components as { name: string; value: number; weight: number; contribution: number }[]) ??
        null,
    }));

    const trend: { direction: 'up' | 'down' | 'flat'; delta: number; streakEpochs: number } = {
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

    // Component-level trends: compare current vs most recent snapshot
    const componentTrends: Record<string, { direction: string; delta: number }> = {};
    if (snapshots?.length) {
      const lastSnapshot = snapshots[0];
      const prevComponents = (lastSnapshot.components as { name: string; value: number }[]) ?? [];

      for (const comp of current.components) {
        const prev = prevComponents.find((c) => c.name === comp.name);
        if (prev) {
          const d = comp.value - prev.value;
          componentTrends[comp.name] = {
            direction: d > 1 ? 'up' : d < -1 ? 'down' : 'flat',
            delta: Math.round(d * 10) / 10,
          };
        }
      }
    }

    const result = {
      current: current as GHIResult,
      history,
      trend,
      componentTrends,
      calibration: GHI_CALIBRATION,
    };

    // CSV export: ?format=csv returns epoch,score,band for easy consumption
    const format = request.nextUrl.searchParams.get('format');
    if (format === 'csv') {
      const csvLines = ['epoch,score,band'];
      for (const h of history) {
        csvLines.push(`${h.epoch},${h.score},${h.band}`);
      }
      csvLines.push(`current,${current.score},${current.band}`);
      return new NextResponse(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="ghi-history.csv"`,
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
      });
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
    });
  },
  { rateLimit: { max: 60, window: 60 } },
);
