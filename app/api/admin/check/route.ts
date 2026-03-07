import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabaseAuth';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

/**
 * POST: Check if the authenticated wallet is an admin.
 * Requires a valid session token via Authorization header.
 */
export const POST = withRouteHandler(async (request) => {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    return NextResponse.json({ isAdmin: isAdminWallet(auth.wallet) });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
});
