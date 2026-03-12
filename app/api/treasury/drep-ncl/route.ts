import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getDRepNclImpact } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request) => {
    const drepId = request.nextUrl.searchParams.get('drepId');
    if (!drepId) {
      return NextResponse.json({ error: 'drepId parameter required' }, { status: 400 });
    }

    const impact = await getDRepNclImpact(drepId);

    return NextResponse.json(
      { impact },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' } },
    );
  },
  { rateLimit: { max: 60, window: 60 } },
);
