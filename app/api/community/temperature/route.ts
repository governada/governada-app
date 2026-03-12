export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import { getGovernanceTemperature } from '@/lib/communityIntelligence';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const enabled = await getFeatureFlag('governance_temperature', false);
  if (!enabled) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const epochParam = searchParams.get('epoch');
  const epoch = epochParam ? parseInt(epochParam, 10) : undefined;

  const temperature = await getGovernanceTemperature(epoch);

  if (!temperature) {
    return NextResponse.json(
      { temperature: 0, band: 'cold', epoch: epoch ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    );
  }

  return NextResponse.json(temperature, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  });
});
