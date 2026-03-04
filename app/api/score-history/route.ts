import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getScoreHistory } from '@/lib/data';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json([], { status: 400 });
  }

  const history = await getScoreHistory(drepId);
  return NextResponse.json(history);
});
