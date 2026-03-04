import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { findSimilarByClassification } from '@/lib/proposalSimilarity';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const tx = request.nextUrl.searchParams.get('tx');
  const indexParam = request.nextUrl.searchParams.get('index');

  if (!tx) {
    return NextResponse.json({ error: 'tx parameter required' }, { status: 400 });
  }

  const index = indexParam ? parseInt(indexParam) : 0;

  const similar = await findSimilarByClassification(tx, index, 5);
  return NextResponse.json(similar, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
  });
});
