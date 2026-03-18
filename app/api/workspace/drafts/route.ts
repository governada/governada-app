/**
 * Proposal Drafts API — list and create drafts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CreateDraftSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { isPreviewAddress } from '@/lib/preview';
import type { ProposalDraft } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspace/drafts?stakeAddress=... — list drafts for a user
 * GET /api/workspace/drafts?status=community_review,final_comment — list community-reviewable drafts
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
  const statusFilter = request.nextUrl.searchParams.get('status');

  const admin = getSupabaseAdmin();

  // Community-reviewable drafts mode: fetch by status (no owner filter)
  if (statusFilter) {
    const statuses = statusFilter.split(',').map((s) => s.trim());

    // Detect preview users: if the requester is a preview user, allow their
    // cohort's drafts to appear alongside real (non-preview) drafts.
    let previewCohortId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const payloadStr = atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadStr);
        if (payload.walletAddress && isPreviewAddress(payload.walletAddress)) {
          const { data: session } = await admin
            .from('preview_sessions')
            .select('cohort_id')
            .eq('user_id', payload.userId)
            .eq('revoked', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (session) {
            previewCohortId = session.cohort_id;
          }
        }
      } catch {
        /* ignore decode errors */
      }
    }

    let query = admin.from('proposal_drafts').select('*').in('status', statuses);

    if (previewCohortId) {
      // Preview user: see their cohort's drafts + real drafts
      query = query.or(`preview_cohort_id.eq.${previewCohortId},preview_cohort_id.is.null`);
    } else {
      // Real user: only see real drafts
      query = query.is('preview_cohort_id', null);
    }

    const { data, error } = await query.order('updated_at', { ascending: false }).limit(50);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    const drafts: ProposalDraft[] = (data ?? []).map(mapDraftRow);
    return NextResponse.json({ drafts });
  }

  // Owner-specific drafts mode
  if (!stakeAddress) {
    return NextResponse.json({ error: 'Missing stakeAddress or status' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('proposal_drafts')
    .select('*')
    .eq('owner_stake_address', stakeAddress)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }

  const drafts: ProposalDraft[] = (data ?? []).map(mapDraftRow);

  return NextResponse.json({ drafts });
});

/** POST /api/workspace/drafts — create a new draft */
export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = CreateDraftSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Tag preview drafts with the user's cohort so cohort members can see them
    let previewCohortId: string | null = null;
    if (isPreviewAddress(body.stakeAddress)) {
      const { data: previewUser } = await admin
        .from('users')
        .select('id')
        .eq('wallet_address', body.stakeAddress)
        .maybeSingle();

      if (previewUser) {
        const { data: session } = await admin
          .from('preview_sessions')
          .select('cohort_id')
          .eq('user_id', previewUser.id)
          .eq('revoked', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          previewCohortId = session.cohort_id;
        }
      }
    }

    // Insert the draft
    const { data: draft, error: draftError } = await admin
      .from('proposal_drafts')
      .insert({
        owner_stake_address: body.stakeAddress,
        title: body.title,
        abstract: body.abstract,
        motivation: body.motivation,
        rationale: body.rationale,
        proposal_type: body.proposalType,
        type_specific: body.typeSpecific ?? {},
        status: 'draft',
        current_version: 1,
        ...(previewCohortId && { preview_cohort_id: previewCohortId }),
      })
      .select()
      .single();

    if (draftError || !draft) {
      logger.error('[drafts] Failed to create draft', {
        error: draftError?.message,
        code: draftError?.code,
      });
      return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
    }

    // Insert initial version
    await admin.from('proposal_draft_versions').insert({
      draft_id: draft.id,
      version_number: 1,
      version_name: 'Initial draft',
      edit_summary: null,
      content: {
        title: body.title,
        abstract: body.abstract,
        motivation: body.motivation,
        rationale: body.rationale,
        proposalType: body.proposalType,
        typeSpecific: body.typeSpecific ?? {},
      },
    });

    captureServerEvent('author_draft_created', {
      draft_id: draft.id,
      proposal_type: body.proposalType,
    });

    return NextResponse.json({ draft: mapDraftRow(draft) }, { status: 201 });
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapDraftRow(row: any): ProposalDraft {
  return {
    id: row.id,
    ownerStakeAddress: row.owner_stake_address,
    title: row.title ?? '',
    abstract: row.abstract ?? '',
    motivation: row.motivation ?? '',
    rationale: row.rationale ?? '',
    proposalType: row.proposal_type,
    typeSpecific: row.type_specific ?? null,
    status: row.status,
    currentVersion: row.current_version ?? 1,
    stageEnteredAt: row.stage_entered_at ?? null,
    communityReviewStartedAt: row.community_review_started_at ?? null,
    fcpStartedAt: row.fcp_started_at ?? null,
    submittedTxHash: row.submitted_tx_hash ?? null,
    submittedAnchorUrl: row.submitted_anchor_url ?? null,
    submittedAnchorHash: row.submitted_anchor_hash ?? null,
    submittedAt: row.submitted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
