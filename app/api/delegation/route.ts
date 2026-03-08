import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { fetchDelegatedDRep } from '@/utils/koios';

const DelegationBody = z.object({
  stakeAddress: z
    .string()
    .min(1, 'stakeAddress is required')
    .regex(/^stake[a-z0-9_]+/, 'Invalid stake address format'),
});

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = DelegationBody.parse(await request.json());

    const drepId = await fetchDelegatedDRep(body.stakeAddress);

    captureServerEvent(
      'delegation_updated',
      { wallet_address: body.stakeAddress, drep_id: drepId },
      body.stakeAddress,
    );

    return NextResponse.json({ drepId });
  },
  { rateLimit: { max: 20, window: 60 } },
);
