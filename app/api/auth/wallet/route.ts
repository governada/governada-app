import { NextRequest, NextResponse } from 'next/server';
import type { DataSignature } from '@meshsdk/core';
import { LEGACY_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME } from '@/lib/persistence';
import { createSessionToken, SESSION_MAX_AGE_SECONDS } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyNonce } from '@/lib/nonce';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { WalletAuthSchema } from '@/lib/api/schemas/auth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    // Lazy-load @meshsdk/core to avoid libsodium initialization crash at server startup.
    // The WASM/asm.js init in libsodium-wrappers-sumo fails in slim containers when loaded eagerly.
    const { checkSignature, resolveRewardAddress } = await import('@meshsdk/core');

    const body = WalletAuthSchema.parse(await request.json());
    const { address, nonce, nonceSignature, signature, key } = body;

    const nonceValid = await verifyNonce(nonce, nonceSignature);
    if (!nonceValid) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    const dataSignature: DataSignature = { signature, key };

    // Must verify against hex-encoded nonce (same format that was signed on client)
    const hexPayload = Array.from(new TextEncoder().encode(nonce))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    let isValid = false;
    try {
      isValid = await checkSignature(hexPayload, dataSignature, address);
    } catch (sigError) {
      logger.error('Signature verification error', { context: 'auth/wallet', error: sigError });
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Derive stake address for wallet dedup
    let stakeAddress: string | null = null;
    try {
      stakeAddress = resolveRewardAddress(address);
    } catch {
      // Script addresses may not resolve — proceed without stake address
    }

    // Multi-step user lookup:
    // 1. Check user_wallets by stake_address
    // 2. Fallback: check users by wallet_address (legacy)
    // 3. If neither: create new user
    let userId: string | null = null;

    if (stakeAddress) {
      const { data: walletRow } = await supabase
        .from('user_wallets')
        .select('user_id')
        .eq('stake_address', stakeAddress)
        .maybeSingle();
      if (walletRow) userId = walletRow.user_id;
    }

    if (!userId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', address)
        .maybeSingle();
      if (userRow) userId = userRow.id;
    }

    if (!userId) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({ wallet_address: address, last_active: new Date().toISOString() })
        .select('id')
        .single();
      if (insertError || !newUser) {
        logger.error('User insert error', { context: 'auth/wallet', error: insertError?.message });
        return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
      }
      userId = newUser.id;
    } else {
      // Update last_active for existing user
      await supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('id', userId);
    }

    // Upsert into user_wallets
    if (stakeAddress) {
      const { error: walletUpsertError } = await supabase.from('user_wallets').upsert(
        {
          stake_address: stakeAddress,
          user_id: userId!,
          payment_address: address,
          last_used: new Date().toISOString(),
        },
        { onConflict: 'stake_address' },
      );
      if (walletUpsertError) {
        logger.warn('Wallet upsert error', {
          context: 'auth/wallet',
          error: walletUpsertError.message,
        });
      }
    }

    const sessionToken = await createSessionToken(userId!, address);

    const response = NextResponse.json({
      sessionToken,
      userId,
      address,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    for (const legacyCookie of LEGACY_SESSION_COOKIE_NAMES) {
      response.cookies.set(legacyCookie, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      });
    }

    captureServerEvent('wallet_authenticated_server', { wallet_address: address }, address);

    return response;
  },
  { auth: 'none', rateLimit: { max: 5, window: 60 } },
);
