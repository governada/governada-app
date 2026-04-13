export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getScoreHistory } from '@/lib/dreps/profileStats';

export const GET = withRouteHandler(async (request) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json([], { status: 400 });
  }

  const history = await getScoreHistory(drepId);
  return NextResponse.json(history);
});
