import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { findSimilarProposals } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const title = request.nextUrl.searchParams.get('title');
  const amount = request.nextUrl.searchParams.get('amount');
  const tier = request.nextUrl.searchParams.get('tier');
  const exclude = request.nextUrl.searchParams.get('exclude');

  if (!title || !amount) {
    return NextResponse.json({ error: 'title and amount parameters required' }, { status: 400 });
  }

  const similar = await findSimilarProposals(
    title,
    parseFloat(amount),
    tier || null,
    exclude || undefined,
  );

  return NextResponse.json(similar, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
});
