import { NextResponse } from 'next/server';
import { getAllFlags, setFeatureFlag, invalidateFlagCache } from '@/lib/featureFlags';
import { requireAuth } from '@/lib/supabaseAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

function isAdminWallet(address: string): boolean {
  const adminWallets = (process.env.ADMIN_WALLETS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminWallets.includes(address.toLowerCase());
}

/**
 * GET: Returns flag boolean map for all callers.
 * Admin-authenticated requests also receive detailed flag metadata.
 */
export const GET = withRouteHandler(async (request) => {
  const allFlags = await getAllFlags();
  const flags: Record<string, boolean> = {};
  for (const f of allFlags) {
    flags[f.key] = f.enabled;
  }

  const auth = await requireAuth(request);
  const isAdmin = !(auth instanceof NextResponse) && isAdminWallet(auth.wallet);

  return NextResponse.json(
    isAdmin ? { flags, details: allFlags } : { flags },
    {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
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
