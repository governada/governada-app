/**
 * Preview Feedback — submit feedback from preview mode users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isPreviewAddress } from '@/lib/preview';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/preview/feedback — save feedback from a preview user
 */
export const POST = withRouteHandler(
  async (request: NextRequest, context) => {
    // Verify caller is a preview user
    if (!context.wallet || !isPreviewAddress(context.wallet)) {
      return NextResponse.json(
        { error: 'Feedback is only available in preview mode' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const page = typeof body.page === 'string' ? body.page : '/';
    const personaPresetId =
      typeof body.personaPresetId === 'string' ? body.personaPresetId : 'unknown';

    if (!text) {
      return NextResponse.json({ error: 'Feedback text is required' }, { status: 400 });
    }

    // Look up active preview session for this user
    const supabase = getSupabaseAdmin();
    const { data: session } = await supabase
      .from('preview_sessions')
      .select('id')
      .eq('user_id', context.userId ?? '')
      .eq('revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: 'No active preview session' }, { status: 403 });
    }

    // Insert feedback
    const { error } = await supabase.from('preview_feedback').insert({
      session_id: session.id,
      page,
      persona_preset_id: personaPresetId,
      text,
    });

    if (error) {
      logger.error('Failed to save preview feedback', {
        context: 'preview/feedback',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    logger.info('Preview feedback saved', {
      context: 'preview/feedback',
      sessionId: session.id,
      page,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);
