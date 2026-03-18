/**
 * Single Draft API — get, update, or archive a specific draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { UpdateDraftSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import type { ProposalDraft, DraftVersion, TeamRole } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ draftId: string }>;
}

/** GET /api/workspace/drafts/[draftId] — fetch draft + versions + user role */
export const GET = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const draftId = request.nextUrl.pathname.split('/').pop();
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const [draftResult, versionsResult] = await Promise.all([
      admin.from('proposal_drafts').select('*').eq('id', draftId).single(),
      admin
        .from('proposal_draft_versions')
        .select('*')
        .eq('draft_id', draftId)
        .order('version_number', { ascending: false }),
    ]);

    if (draftResult.error || !draftResult.data) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Check if the requesting user is a team member
    let userRole: TeamRole | null = null;
    if (ctx.wallet) {
      // First check team membership
      const { data: teamRow } = await admin
        .from('proposal_teams')
        .select('id')
        .eq('draft_id', draftId)
        .maybeSingle();

      if (teamRow) {
        const { data: memberRow } = await admin
          .from('proposal_team_members')
          .select('role')
          .eq('team_id', teamRow.id)
          .eq('stake_address', ctx.wallet)
          .maybeSingle();

        if (memberRow) {
          userRole = memberRow.role as TeamRole;
        }
      }

      // Owner always counts as lead
      if (draftResult.data.owner_stake_address === ctx.wallet && !userRole) {
        userRole = 'lead';
      }
    }

    return NextResponse.json({
      draft: mapDraftRow(draftResult.data),
      versions: (versionsResult.data ?? []).map(mapVersionRow),
      userRole,
    });
  },
  { auth: 'optional' },
);

/** PATCH /api/workspace/drafts/[draftId] — update draft fields (auto-save) */
export const PATCH = withRouteHandler(
  async (request: NextRequest) => {
    const segments = request.nextUrl.pathname.split('/');
    const draftId = segments[segments.length - 1];
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = UpdateDraftSchema.parse(await request.json());

    const admin = getSupabaseAdmin();

    // Build update fields (only include provided fields)
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updateFields.title = body.title;
    if (body.abstract !== undefined) updateFields.abstract = body.abstract;
    if (body.motivation !== undefined) updateFields.motivation = body.motivation;
    if (body.rationale !== undefined) updateFields.rationale = body.rationale;
    if (body.proposalType !== undefined) updateFields.proposal_type = body.proposalType;
    if (body.typeSpecific !== undefined) updateFields.type_specific = body.typeSpecific;
    if (body.status !== undefined) updateFields.status = body.status;

    const { data, error } = await admin
      .from('proposal_drafts')
      .update(updateFields)
      .eq('id', draftId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
    }

    return NextResponse.json({ draft: mapDraftRow(data) });
  },
  { auth: 'none', rateLimit: { max: 60, window: 60 } },
);

/** DELETE /api/workspace/drafts/[draftId]?stakeAddress=... — permanently delete a draft */
export const DELETE = withRouteHandler(
  async (request: NextRequest) => {
    const segments = request.nextUrl.pathname.split('/');
    const draftId = segments[segments.length - 1];
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
    if (!stakeAddress) {
      return NextResponse.json({ error: 'Missing stakeAddress' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch draft and verify ownership
    const { data: draft, error: fetchError } = await admin
      .from('proposal_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (draft.owner_stake_address !== stakeAddress) {
      return NextResponse.json({ error: 'Only the owner can delete a draft' }, { status: 403 });
    }

    // Only allow deleting drafts in 'draft' status
    if (draft.status !== 'draft') {
      return NextResponse.json(
        {
          error: `Cannot delete a draft in '${draft.status}' status. Only drafts in 'draft' status can be permanently deleted. Use archive instead.`,
        },
        { status: 403 },
      );
    }

    // Delete related records in order (respecting foreign key constraints)
    // 1. Team members -> teams
    const { data: teamRows } = await admin
      .from('proposal_teams')
      .select('id')
      .eq('draft_id', draftId);

    if (teamRows && teamRows.length > 0) {
      const teamIds = teamRows.map((t) => t.id);
      // Delete invite links
      await admin.from('proposal_team_invites').delete().in('team_id', teamIds);
      // Delete team members
      await admin.from('proposal_team_members').delete().in('team_id', teamIds);
      // Delete teams
      await admin.from('proposal_teams').delete().eq('draft_id', draftId);
    }

    // 2. Draft review responses -> draft reviews
    const { data: reviewRows } = await admin
      .from('draft_reviews')
      .select('id')
      .eq('draft_id', draftId);

    if (reviewRows && reviewRows.length > 0) {
      const reviewIds = reviewRows.map((r) => r.id);
      await admin.from('draft_review_responses').delete().in('review_id', reviewIds);
      await admin.from('draft_reviews').delete().eq('draft_id', draftId);
    }

    // 3. Amendment genealogy
    await admin.from('amendment_genealogy').delete().eq('draft_id', draftId);

    // 4. Amendment section sentiment
    await admin.from('amendment_section_sentiment').delete().eq('draft_id', draftId);

    // 5. Versions
    await admin.from('proposal_draft_versions').delete().eq('draft_id', draftId);

    // 6. CIP-108 documents
    await admin.from('cip108_documents').delete().eq('draft_id', draftId);

    // 7. AI activity log entries
    await admin.from('ai_activity_log').delete().eq('draft_id', draftId);

    // 8. Finally delete the draft itself
    const { error: deleteError } = await admin.from('proposal_drafts').delete().eq('id', draftId);

    if (deleteError) {
      logger.error('[drafts] Failed to delete draft', {
        error: deleteError.message,
        draftId,
      });
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    captureServerEvent(
      'author_draft_deleted',
      {
        draft_id: draftId,
        proposal_type: draft.proposal_type,
      },
      stakeAddress,
    );

    return NextResponse.json({ success: true });
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
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
    supersedesId: row.supersedes_id ?? null,
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

function mapVersionRow(row: any): DraftVersion {
  return {
    id: row.id,
    draftId: row.draft_id,
    versionNumber: row.version_number,
    versionName: row.version_name ?? '',
    editSummary: row.edit_summary ?? null,
    content: row.content,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Export RouteParams for type usage (prevents unused import warning)
void (0 as unknown as RouteParams);
