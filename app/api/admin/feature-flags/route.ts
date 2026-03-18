import { NextResponse } from 'next/server';
import { getAllFlags, setFeatureFlag, invalidateFlagCache } from '@/lib/featureFlags';
import { requireAuth } from '@/lib/supabaseAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Resolve a payment address to a stake address via user_wallets.
 * Returns an array of addresses to check against targeting (always includes the input).
 */
async function resolveTargetingAddresses(wallet: string): Promise<string[]> {
  const addresses = [wallet];
  // If it already looks like a stake address, no lookup needed
  if (wallet.startsWith('stake')) return addresses;

  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('user_wallets')
      .select('stake_address')
      .eq('payment_address', wallet)
      .limit(1)
      .maybeSingle();
    if (data?.stake_address) {
      addresses.push(data.stake_address);
    }
  } catch {
    // Fall through — only the raw address will be checked
  }
  return addresses;
}

/**
 * GET: Returns flag boolean map for all callers.
 * When a `wallet` query param is provided, per-wallet targeting overrides are applied.
 * Admin-authenticated requests also receive detailed flag metadata.
 */
export const GET = withRouteHandler(async (request) => {
  const allFlags = await getAllFlags();
  const walletParam = new URL(request.url).searchParams.get('wallet') ?? undefined;

  // Resolve targeting addresses (payment -> stake address lookup)
  const targetingAddresses = walletParam ? await resolveTargetingAddresses(walletParam) : [];

  const flags: Record<string, boolean> = {};
  for (const f of allFlags) {
    // Apply per-wallet targeting override if a wallet address was provided
    if (targetingAddresses.length > 0) {
      const targeting = f.targeting as { wallets?: Record<string, boolean> } | null;
      if (targeting?.wallets) {
        const matchedAddr = targetingAddresses.find((addr) => addr in targeting.wallets!);
        if (matchedAddr) {
          flags[f.key] = targeting.wallets[matchedAddr];
          continue;
        }
      }
    }
    flags[f.key] = f.enabled;
  }

  const auth = await requireAuth(request);
  const isAdmin = !(auth instanceof NextResponse) && isAdminWallet(auth.wallet);

  return NextResponse.json(isAdmin ? { flags, details: allFlags } : { flags }, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
});

/**
 * PATCH: Toggle a flag. Requires an authenticated admin session.
 */
export const PATCH = withRouteHandler(async (request) => {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!isAdminWallet(auth.wallet)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { key, enabled } = body;

  if (typeof key !== 'string' || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'Invalid body: { key: string, enabled: boolean }' },
      { status: 400 },
    );
  }

  const success = await setFeatureFlag(key, enabled);
  if (!success) {
    return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
  }

  invalidateFlagCache();
  logAdminAction(auth.wallet, 'toggle_feature_flag', key, { enabled });

  return NextResponse.json({ key, enabled });
});
