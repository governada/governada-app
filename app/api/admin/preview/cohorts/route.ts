/**
 * Admin Preview Cohorts — CRUD for preview data namespaces.
 *
 * Cohorts group preview sessions so testers share drafts, votes, and
 * annotations within their testing group without polluting real data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/preview/cohorts — list all cohorts with counts
 */
export const GET = withRouteHandler(
  async (_request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: cohorts, error } = await supabase
      .from('preview_cohorts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list preview cohorts', {
        context: 'admin/preview/cohorts',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
    }

    // Get invite and session counts per cohort
    const cohortIds = (cohorts ?? []).map((c: { id: string }) => c.id);

    const [inviteCounts, sessionCounts] = await Promise.all([
      cohortIds.length > 0
        ? supabase.from('preview_invites').select('cohort_id').in('cohort_id', cohortIds)
        : Promise.resolve({ data: [] }),
      cohortIds.length > 0
        ? supabase.from('preview_sessions').select('cohort_id').in('cohort_id', cohortIds)
        : Promise.resolve({ data: [] }),
    ]);

    const inviteCountMap = new Map<string, number>();
    for (const row of inviteCounts.data ?? []) {
      inviteCountMap.set(row.cohort_id, (inviteCountMap.get(row.cohort_id) ?? 0) + 1);
    }

    const sessionCountMap = new Map<string, number>();
    for (const row of sessionCounts.data ?? []) {
      sessionCountMap.set(row.cohort_id, (sessionCountMap.get(row.cohort_id) ?? 0) + 1);
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const result = (cohorts ?? []).map((c: any) => ({
      ...c,
      invite_count: inviteCountMap.get(c.id) ?? 0,
      session_count: sessionCountMap.get(c.id) ?? 0,
    }));

    /* eslint-enable @typescript-eslint/no-explicit-any */
    return NextResponse.json({ cohorts: result });
  },
  { auth: 'required' },
);

/**
 * POST /api/admin/preview/cohorts — create a new cohort
 */
export const POST = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'Missing cohort name' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: cohort, error } = await supabase
      .from('preview_cohorts')
      .insert({
        name,
        description: typeof body.description === 'string' ? body.description : null,
        created_by: context.wallet,
      })
      .select()
      .single();

    if (error || !cohort) {
      logger.error('Failed to create preview cohort', {
        context: 'admin/preview/cohorts',
        error: error?.message,
      });
      return NextResponse.json({ error: 'Failed to create cohort' }, { status: 500 });
    }

    return NextResponse.json({ cohort }, { status: 201 });
  },
  { auth: 'required' },
);
