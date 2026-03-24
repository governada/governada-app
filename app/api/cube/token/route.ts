export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { isAdminWallet } from '@/lib/adminAuth';

/**
 * POST /api/cube/token
 *
 * Generates a short-lived JWT for authenticating with the Cube API.
 * Requires admin authentication.
 */
export const POST = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!ctx.wallet || !isAdminWallet(ctx.wallet)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const secret = process.env.CUBE_API_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Cube API not configured' }, { status: 500 });
    }

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));

    return NextResponse.json({ token });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
