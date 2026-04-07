import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { buildReviewQueue } from '@/lib/workspace/reviewQueue';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const voterId = request.nextUrl.searchParams.get('voterId');
  const voterRole = request.nextUrl.searchParams.get('voterRole') || 'drep';

  if (!voterId) {
    return NextResponse.json({ error: 'Missing voterId' }, { status: 400 });
  }

  const queue = await buildReviewQueue({
    voterId,
    voterRole: voterRole === 'spo' ? 'spo' : 'drep',
  });

  return NextResponse.json(queue);
});
