import { NextResponse } from 'next/server';
import { createNonce } from '@/lib/nonce';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async () => {
    const nonceData = await createNonce();
    return NextResponse.json(nonceData);
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
);
