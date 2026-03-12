import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getDelegatorIntelligence } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const intelligence = await getDelegatorIntelligence(drepId);

  return NextResponse.json(intelligence, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=120' },
  });
});
