/**
 * Admin Preview Invites — create and list invite codes within cohorts.
 *
 * Each invite maps to a persona preset from the View As registry,
 * so testers experience the app as a specific user segment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { SEGMENT_PRESETS } from '@/lib/admin/viewAsRegistry';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/preview/invites?cohort_id=... — list invites
 */
export const GET = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cohortId = request.nextUrl.searchParams.get('cohort_id');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('preview_invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    const { data: invites, error } = await query;

    if (error) {
      logger.error('Failed to list preview invites', {
        context: 'admin/preview/invites',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
    }

    return NextResponse.json({ invites: invites ?? [] });
  },
  { auth: 'required' },
);

/**
 * POST /api/admin/preview/invites — create a new invite code
 */
export const POST = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const cohortId = typeof body.cohortId === 'string' ? body.cohortId : '';
    const personaPresetId = typeof body.personaPresetId === 'string' ? body.personaPresetId : '';

    if (!cohortId) {
      return NextResponse.json({ error: 'Missing cohortId' }, { status: 400 });
    }
    if (!personaPresetId) {
      return NextResponse.json({ error: 'Missing personaPresetId' }, { status: 400 });
    }

    // Validate persona preset exists
    const preset = SEGMENT_PRESETS.find((p) => p.id === personaPresetId);
    if (!preset) {
      return NextResponse.json(
        { error: `Invalid personaPresetId: ${personaPresetId}` },
        { status: 400 },
      );
    }

    const segmentOverrides =
      body.segmentOverrides && typeof body.segmentOverrides === 'object'
        ? body.segmentOverrides
        : {};
    const expiresInDays =
      typeof body.expiresInDays === 'number' && body.expiresInDays > 0 ? body.expiresInDays : 7;
    const maxUses = typeof body.maxUses === 'number' && body.maxUses > 0 ? body.maxUses : 10;
    const notes = typeof body.notes === 'string' ? body.notes : null;

    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const supabase = getSupabaseAdmin();

    const { data: invite, error } = await supabase
      .from('preview_invites')
      .insert({
        cohort_id: cohortId,
        code,
        persona_preset_id: personaPresetId,
        segment_overrides: segmentOverrides,
        expires_at: expiresAt,
        max_uses: maxUses,
        use_count: 0,
        revoked: false,
        notes,
        created_by: context.wallet,
      })
      .select()
      .single();

    if (error || !invite) {
      logger.error('Failed to create preview invite', {
        context: 'admin/preview/invites',
        error: error?.message,
      });
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    return NextResponse.json({ invite }, { status: 201 });
  },
  { auth: 'required' },
);
