export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { requireAuth } from '@/lib/supabaseAuth';

/**
 * POST /api/cube/token
 *
 * Generates a short-lived JWT for authenticating with the Cube API.
 * Requires admin authentication.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
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
}
