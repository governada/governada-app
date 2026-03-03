import { NextRequest, NextResponse } from 'next/server';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { fetchDelegatedDRep } from '@/utils/koios';

export const POST = withRouteHandler(async (request: NextRequest) => {
  const { stakeAddress } = await request.json();

  if (!stakeAddress || typeof stakeAddress !== 'string') {
    return NextResponse.json({ error: 'stakeAddress required' }, { status: 400 });
  }

  const drepId = await fetchDelegatedDRep(stakeAddress);

  captureServerEvent(
    'delegation_updated',
    { wallet_address: stakeAddress, drep_id: drepId },
    stakeAddress,
  );

  return NextResponse.json({ drepId });
});
