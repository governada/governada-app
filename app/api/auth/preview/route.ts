/**
 * Preview Auth — invite-code-based authentication for preview mode.
 *
 * Creates a synthetic wallet address and session for testers, scoped
 * to a cohort for shared data namespaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LEGACY_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME } from '@/lib/persistence';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSessionToken, SESSION_MAX_AGE_SECONDS } from '@/lib/supabaseAuth';
import { getFeatureFlag } from '@/lib/featureFlags';
import { generatePreviewAddress } from '@/lib/preview';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    // Gate behind feature flag
    const enabled = await getFeatureFlag('preview_mode', false);
    if (!enabled) {
      return NextResponse.json(
        { error: 'Preview mode is not currently available' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return NextResponse.json({ error: 'Missing invite code' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Look up the invite
    const { data: invite, error: inviteError } = await supabase
      .from('preview_invites')
      .select('*')
      .eq('code', code)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (inviteError) {
      logger.error('Preview invite lookup failed', {
        context: 'auth/preview',
        error: inviteError.message,
      });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    if (!invite) {
      return NextResponse.json({ error: 'Invalid or expired invite code' }, { status: 401 });
    }

    if (invite.use_count >= invite.max_uses) {
      return NextResponse.json({ error: 'Invite code has been fully used' }, { status: 401 });
    }

    // Generate synthetic address and create user
    const syntheticAddress = generatePreviewAddress(code);

    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert(
        { wallet_address: syntheticAddress, last_active: new Date().toISOString() },
        { onConflict: 'wallet_address' },
      )
      .select('id')
      .single();

    if (userError || !user) {
      logger.error('Preview user upsert failed', {
        context: 'auth/preview',
        error: userError?.message,
      });
      return NextResponse.json({ error: 'Failed to create preview user' }, { status: 500 });
    }

    // Create preview session row
    const { data: previewSession, error: sessionError } = await supabase
      .from('preview_sessions')
      .insert({
        invite_id: invite.id,
        user_id: user.id,
        cohort_id: invite.cohort_id,
        persona_snapshot: invite.segment_overrides ?? {},
      })
      .select('id')
      .single();

    if (sessionError || !previewSession) {
      logger.error('Preview session insert failed', {
        context: 'auth/preview',
        error: sessionError?.message,
      });
      return NextResponse.json({ error: 'Failed to create preview session' }, { status: 500 });
    }

    // Increment invite use count
    await supabase
      .from('preview_invites')
      .update({ use_count: invite.use_count + 1 })
      .eq('id', invite.id);

    // Create JWT session
    const sessionToken = await createSessionToken(user.id, syntheticAddress);

    const response = NextResponse.json({
      sessionToken,
      userId: user.id,
      previewSessionId: previewSession.id,
      personaPresetId: invite.persona_preset_id,
      cohortId: invite.cohort_id,
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

    logger.info('Preview session created', {
      context: 'auth/preview',
      userId: user.id,
      cohortId: invite.cohort_id,
      presetId: invite.persona_preset_id,
    });

    return response;
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
);
