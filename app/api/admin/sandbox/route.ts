/**
 * Admin Sandbox API — manage admin sandbox cohorts for testing.
 *
 * Sandbox cohorts are special preview cohorts that let admins test
 * the full authoring/review workflow without polluting production data.
 * They are identified by a `[ADMIN_SANDBOX]` prefix in the description
 * field of preview_cohorts.
 *
 * GET  — List admin's sandbox cohorts
 * POST — Create or reset a sandbox cohort
 *
 * NOTE: Ideally preview_cohorts would have an `is_admin_sandbox` boolean
 * column, but we use the description prefix convention to avoid a migration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { SANDBOX_DESCRIPTION_PREFIX } from '@/lib/admin/sandbox';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/sandbox — list sandbox cohorts for the current admin
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
      .eq('created_by', context.wallet)
      .like('description', `${SANDBOX_DESCRIPTION_PREFIX}%`)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list sandbox cohorts', {
        context: 'admin/sandbox',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to fetch sandbox cohorts' }, { status: 500 });
    }

    return NextResponse.json({ cohorts: cohorts ?? [] });
  },
  { auth: 'required' },
);

/**
 * POST /api/admin/sandbox — create or reset a sandbox cohort
 *
 * Body: { action: 'create' | 'reset', cohortId?: string }
 * - 'create': creates a new sandbox cohort or returns existing one
 * - 'reset': clears all data in the specified sandbox cohort
 */
export const POST = withRouteHandler(
  async (request: NextRequest, context) => {
    if (!context.wallet || !isAdminWallet(context.wallet)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const action = typeof body.action === 'string' ? body.action : 'create';

    const supabase = getSupabaseAdmin();

    // -----------------------------------------------------------------------
    // Action: create (or return existing)
    // -----------------------------------------------------------------------
    if (action === 'create') {
      // Check if admin already has a sandbox cohort
      const { data: existing } = await supabase
        .from('preview_cohorts')
        .select('*')
        .eq('created_by', context.wallet)
        .like('description', `${SANDBOX_DESCRIPTION_PREFIX}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ cohort: existing, created: false });
      }

      // Create a new sandbox cohort
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const name = `Admin Sandbox — ${dateStr}`;
      const description = `${SANDBOX_DESCRIPTION_PREFIX} Created by admin for testing. Wallet: ${context.wallet.slice(0, 20)}...`;

      const { data: cohort, error } = await supabase
        .from('preview_cohorts')
        .insert({
          name,
          description,
          created_by: context.wallet,
        })
        .select()
        .single();

      if (error || !cohort) {
        logger.error('Failed to create sandbox cohort', {
          context: 'admin/sandbox',
          error: error?.message,
        });
        return NextResponse.json({ error: 'Failed to create sandbox cohort' }, { status: 500 });
      }

      logger.info('[admin/sandbox] Created sandbox cohort', {
        cohortId: cohort.id,
        wallet: context.wallet.slice(0, 20) + '...',
      });

      return NextResponse.json({ cohort, created: true }, { status: 201 });
    }

    // -----------------------------------------------------------------------
    // Action: reset — clear all data in the sandbox cohort
    // -----------------------------------------------------------------------
    if (action === 'reset') {
      const cohortId = typeof body.cohortId === 'string' ? body.cohortId.trim() : '';
      if (!cohortId) {
        return NextResponse.json({ error: 'Missing cohortId for reset' }, { status: 400 });
      }

      // Verify the cohort exists and is an admin sandbox owned by this wallet
      const { data: cohort, error: cohortError } = await supabase
        .from('preview_cohorts')
        .select('id, description, created_by')
        .eq('id', cohortId)
        .maybeSingle();

      if (cohortError || !cohort) {
        return NextResponse.json({ error: 'Sandbox cohort not found' }, { status: 404 });
      }

      if (
        !cohort.description?.startsWith(SANDBOX_DESCRIPTION_PREFIX) ||
        cohort.created_by !== context.wallet
      ) {
        return NextResponse.json({ error: 'Not a sandbox cohort owned by you' }, { status: 403 });
      }

      // Clean up data in FK order: reviews -> versions -> drafts
      const { data: existingDrafts } = await supabase
        .from('proposal_drafts')
        .select('id')
        .eq('preview_cohort_id', cohortId);

      const draftIds = (existingDrafts ?? []).map((d) => d.id);
      let deletedReviews = 0;
      let deletedVersions = 0;
      let deletedDrafts = 0;

      if (draftIds.length > 0) {
        const { count: reviewCount, error: reviewError } = await supabase
          .from('draft_reviews')
          .delete({ count: 'exact' })
          .in('draft_id', draftIds);

        if (reviewError) {
          logger.error('[admin/sandbox] Failed to cleanup reviews', {
            cohortId,
            error: reviewError.message,
          });
        }
        deletedReviews = reviewCount ?? 0;

        const { count: versionCount, error: versionError } = await supabase
          .from('proposal_draft_versions')
          .delete({ count: 'exact' })
          .in('draft_id', draftIds);

        if (versionError) {
          logger.error('[admin/sandbox] Failed to cleanup versions', {
            cohortId,
            error: versionError.message,
          });
        }
        deletedVersions = versionCount ?? 0;

        const { count: draftCount, error: draftError } = await supabase
          .from('proposal_drafts')
          .delete({ count: 'exact' })
          .eq('preview_cohort_id', cohortId);

        if (draftError) {
          logger.error('[admin/sandbox] Failed to cleanup drafts', {
            cohortId,
            error: draftError.message,
          });
        }
        deletedDrafts = draftCount ?? 0;
      }

      logger.info('[admin/sandbox] Reset sandbox cohort', {
        cohortId,
        deletedReviews,
        deletedVersions,
        deletedDrafts,
      });

      return NextResponse.json({
        success: true,
        deleted: {
          reviews: deletedReviews,
          versions: deletedVersions,
          drafts: deletedDrafts,
        },
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  },
  { auth: 'required' },
);
