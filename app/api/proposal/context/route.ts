import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getProposalHistoricalContext } from '@/lib/proposalContext';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const txHash = searchParams.get('txHash');
    const index = parseInt(searchParams.get('index') || '0', 10);

    if (!txHash) {
      return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
    }

    const context = await getProposalHistoricalContext(txHash, index);

    if (!context) {
      return NextResponse.json(null, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    return NextResponse.json(context, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300' },
    });
  },
  { rateLimit: { max: 60, window: 60 } },
);
