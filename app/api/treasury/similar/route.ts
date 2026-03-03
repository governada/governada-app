import { NextRequest, NextResponse } from 'next/server';
import { findSimilarProposals } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('[treasury/similar] Error:', error);
    return NextResponse.json({ error: 'Failed to find similar proposals' }, { status: 500 });
  }
}
