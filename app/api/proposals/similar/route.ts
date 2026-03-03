import { NextRequest, NextResponse } from 'next/server';
import { findSimilarByClassification } from '@/lib/proposalSimilarity';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('[proposals/similar] Error:', error);
    return NextResponse.json({ error: 'Failed to find similar proposals' }, { status: 500 });
  }
}
