/**
 * Admin Preview Sessions — list and revoke active preview sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/preview/sessions?cohort_id=... — list active sessions
 */
export const GET = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cohortId = request.nextUrl.searchParams.get('cohort_id');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('preview_sessions')
      .select('*')
      .eq('revoked', false)
      .order('created_at', { ascending: false });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data: sessions, error } = await query;

    if (error) {
      logger.error('Failed to list preview sessions', {
        context: 'admin/preview/sessions',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    return NextResponse.json({ sessions: sessions ?? [] });
  },
  { auth: 'required' },
);

/**
 * DELETE /api/admin/preview/sessions — revoke a session
 */
export const DELETE = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('preview_sessions')
      .update({ revoked: true })
      .eq('id', sessionId);

    if (error) {
      logger.error('Failed to revoke preview session', {
        context: 'admin/preview/sessions',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to revoke session' }, { status: 500 });
    }

    logger.info('Preview session revoked', {
      context: 'admin/preview/sessions',
      sessionId,
      revokedBy: context.wallet,
    });

    return NextResponse.json({ revoked: true });
  },
  { auth: 'required' },
);
