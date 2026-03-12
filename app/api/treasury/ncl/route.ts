import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import {
  getNclUtilization,
  getNclUtilizationHistory,
  getNclSpendingVelocity,
} from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (req: NextRequest) => {
    const includeHistory = req.nextUrl.searchParams.get('history') === 'true';
    const ncl = await getNclUtilization();

    if (!ncl) {
      return NextResponse.json(
        { error: 'No active NCL period', ncl: null, history: null, velocity: null },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
      );
    }

    if (includeHistory) {
      const [history, velocity] = await Promise.all([
        getNclUtilizationHistory(),
        getNclSpendingVelocity(),
      ]);
      return NextResponse.json(
        { ncl, history, velocity },
        { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
      );
    }

    return NextResponse.json(
      { ncl },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
    );
  },
  { rateLimit: { max: 60, window: 60 } },
);
