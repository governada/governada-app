/**
 * Admin Preview Feedback — list feedback from preview users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/preview/feedback?cohort_id=... — list all feedback, optionally filtered by cohort
 */
export const GET = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cohortId = request.nextUrl.searchParams.get('cohort_id');
    const supabase = getSupabaseAdmin();

    // Join feedback with preview_sessions to get cohort info
    let query = supabase
      .from('preview_feedback')
      .select(
        'id, session_id, page, persona_preset_id, text, created_at, preview_sessions!inner(cohort_id)',
      )
      .order('created_at', { ascending: false })
      .limit(200);

    if (cohortId) {
      query = query.eq('preview_sessions.cohort_id', cohortId);
    }

    const { data: rows, error } = await query;

    if (error) {
      logger.error('Failed to list preview feedback', {
        context: 'admin/preview/feedback',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    const feedback = (rows ?? []).map((row) => {
      const sessions = row.preview_sessions as unknown as { cohort_id: string } | null;
      return {
        id: row.id,
        sessionId: row.session_id,
        page: row.page,
        personaPresetId: row.persona_preset_id,
        text: row.text,
        createdAt: row.created_at,
        cohortId: sessions?.cohort_id ?? null,
      };
    });

    return NextResponse.json({ feedback });
  },
  { auth: 'required' },
);
