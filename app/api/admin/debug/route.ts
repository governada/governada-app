import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabaseAuth';
import { isAdminWallet } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * POST: Debug admin check — returns detailed diagnostics.
 * Requires a valid session token via Authorization header.
 * TEMPORARY — remove after debugging.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return NextResponse.json({
        step: 'auth',
        error: 'Session token invalid or missing',
        hasAuthHeader: !!request.headers.get('authorization'),
      });
    }

    const adminWalletsRaw = process.env.ADMIN_WALLETS || '';
    const adminWallets = adminWalletsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const result = isAdminWallet(auth.wallet);

    return NextResponse.json({
      step: 'complete',
      walletFromSession: auth.wallet.slice(0, 15) + '...' + auth.wallet.slice(-6),
      walletPrefix: auth.wallet.slice(0, 5),
      adminWalletsCount: adminWallets.length,
      adminWalletPrefixes: adminWallets.map((w) => w.slice(0, 10) + '...'),
      adminWalletLengths: adminWallets.map((w) => w.length),
      envVarLength: adminWalletsRaw.length,
      envVarHasQuotes: adminWalletsRaw.startsWith('"') || adminWalletsRaw.startsWith("'"),
      isAdmin: result,
    });
  } catch (e) {
    return NextResponse.json({ step: 'error', error: String(e) });
  }
}
