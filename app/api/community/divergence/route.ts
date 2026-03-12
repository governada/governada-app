export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import { getSentimentDivergence } from '@/lib/communityIntelligence';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const enabled = await getFeatureFlag('sentiment_divergence', false);
  if (!enabled) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const epochParam = searchParams.get('epoch');
  const epoch = epochParam ? parseInt(epochParam, 10) : undefined;

  const divergence = await getSentimentDivergence(epoch);

  if (!divergence) {
    return NextResponse.json(
      { proposals: [], aggregateDivergence: 0, epoch: epoch ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    );
  }

  return NextResponse.json(divergence, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
});
