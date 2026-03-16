/**
 * Single Draft API — get, update, or archive a specific draft.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { UpdateDraftSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
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

/** DELETE /api/workspace/drafts/[draftId] — archive a draft */
export const DELETE = withRouteHandler(async (request: NextRequest) => {
  const segments = request.nextUrl.pathname.split('/');
  const draftId = segments[segments.length - 1];
  if (!draftId) {
    return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { error } = await admin
    .from('proposal_drafts')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', draftId);

  if (error) {
    return NextResponse.json({ error: 'Failed to archive draft' }, { status: 500 });
  }

  captureServerEvent('author_draft_archived', { draft_id: draftId });

  return NextResponse.json({ success: true });
});

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
