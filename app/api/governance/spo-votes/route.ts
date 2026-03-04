import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSpoVotesByProposal } from '@/lib/data';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const tx = request.nextUrl.searchParams.get('tx');
  const indexParam = request.nextUrl.searchParams.get('index');

  if (!tx) {
    return NextResponse.json({ error: 'tx parameter required' }, { status: 400 });
  }

  const index = indexParam ? parseInt(indexParam) : 0;
  const votes = await getSpoVotesByProposal(tx, index);

  return NextResponse.json(votes, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
});
