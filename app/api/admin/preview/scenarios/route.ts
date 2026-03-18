/**
 * Admin Scenario Generator API — populate preview cohorts with realistic data.
 *
 * POST /api/admin/preview/scenarios
 * Body: { cohortId: string }
 *
 * Generates proposal drafts at various lifecycle stages, synthetic reviews,
 * and version history. All data is tagged with `preview_cohort_id`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { generateScenario } from '@/lib/preview/scenarios/generator';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/preview/scenarios — generate scenario data for a cohort
 */
export const POST = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const cohortId = typeof body.cohortId === 'string' ? body.cohortId.trim() : '';

    if (!cohortId) {
      return NextResponse.json({ error: 'Missing cohortId' }, { status: 400 });
    }

    // Verify cohort exists
    const supabase = getSupabaseAdmin();
    const { data: cohort, error: cohortError } = await supabase
      .from('preview_cohorts')
      .select('id, name')
      .eq('id', cohortId)
      .single();

    if (cohortError || !cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    logger.info('[admin/preview/scenarios] Starting scenario generation', {
      cohortId,
      cohortName: cohort.name,
      requestedBy: context.wallet,
    });

    const result = await generateScenario(cohortId);

    const statusCode = result.errors.length > 0 ? 207 : 200;

    return NextResponse.json(
      {
        proposalsCreated: result.proposalsCreated,
        reviewsCreated: result.reviewsCreated,
        versionsCreated: result.versionsCreated,
        errors: result.errors,
      },
      { status: statusCode },
    );
  },
  { auth: 'required' },
);
