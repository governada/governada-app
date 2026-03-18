import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabaseAuth';
import { isAdminWallet } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { setUserFlagOverride, invalidateFlagCache } from '@/lib/featureFlags';
import { createClient } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

/**
 * GET: Returns targeting overrides for a specific flag.
 * Query: ?key=flagName
 */
export const GET = withRouteHandler(async (request) => {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!isAdminWallet(auth.wallet)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (!key) {
    return NextResponse.json({ error: 'Missing query param: key' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('feature_flags')
    .select('targeting')
    .eq('key', key)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
  }

  return NextResponse.json({ key, targeting: data.targeting ?? {} });
});

/**
 * POST: Set or remove a per-user flag override.
 * Body: { key: string, walletAddress: string, enabled: boolean | null }
 * enabled: null removes the override.
 */
export const POST = withRouteHandler(async (request) => {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  if (!isAdminWallet(auth.wallet)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { key, walletAddress, enabled } = body;

  if (typeof key !== 'string' || typeof walletAddress !== 'string') {
    return NextResponse.json(
      { error: 'Invalid body: { key: string, walletAddress: string, enabled: boolean | null }' },
      { status: 400 },
    );
  }

  if (enabled !== null && typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be boolean or null' }, { status: 400 });
  }

  const success = await setUserFlagOverride(key, walletAddress, enabled);
  if (!success) {
    return NextResponse.json({ error: 'Failed to update targeting' }, { status: 500 });
  }

  invalidateFlagCache();

  const action = enabled === null ? 'remove' : enabled ? 'enable' : 'disable';
  logAdminAction(auth.wallet, 'set_user_flag_override', key, {
    walletAddress,
    action,
  });

  return NextResponse.json({ key, walletAddress, enabled });
});
