import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { detectUserSegment } from '@/lib/walletDetection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/detect-segment?stakeAddress=stake1...
 * Detects user segment (citizen, spo, drep) from their stake address.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const stakeAddress = searchParams.get('stakeAddress');

  if (!stakeAddress) {
    return NextResponse.json({ error: 'Required: stakeAddress' }, { status: 400 });
  }

  const result = await detectUserSegment(stakeAddress);

  return NextResponse.json(result);
});
