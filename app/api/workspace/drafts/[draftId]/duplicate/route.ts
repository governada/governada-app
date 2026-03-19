/**
 * Duplicate Draft API — create a copy of an existing draft.
 *
 * POST /api/workspace/drafts/[draftId]/duplicate
 * Body: { stakeAddress: string, titlePrefix?: string }
 * Returns: { draft: ProposalDraft }
 *
 * Allows duplicating any draft regardless of status (including submitted/archived).
 * The new draft starts at status 'draft' with version 1 and records lineage
 * via supersedes_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { DuplicateDraftSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import type { ProposalDraft } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

function extractDraftId(pathname: string): string | null {
  const match = pathname.match(/\/drafts\/([^/]+)\/duplicate/);
  return match?.[1] ?? null;
}

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const draftId = extractDraftId(request.nextUrl.pathname);
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = DuplicateDraftSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch source draft (any status is allowed for duplication)
    const { data: source, error: fetchError } = await admin
      .from('proposal_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !source) {
      return NextResponse.json({ error: 'Source draft not found' }, { status: 404 });
    }

    const titlePrefix = body.titlePrefix || 'Copy of';
    const newTitle = `${titlePrefix} ${source.title}`.slice(0, 200);

    // Create the duplicate draft
    const { data: draft, error: insertError } = await admin
      .from('proposal_drafts')
      .insert({
        owner_stake_address: body.stakeAddress,
        title: newTitle,
        abstract: source.abstract,
        motivation: source.motivation,
        rationale: source.rationale,
        proposal_type: source.proposal_type,
        type_specific: source.type_specific ?? {},
        status: 'draft',
        current_version: 1,
        supersedes_id: source.id,
      })
      .select()
      .single();

    if (insertError || !draft) {
      logger.error('[duplicate] Failed to create duplicate draft', {
        error: insertError?.message,
        sourceDraftId: draftId,
      });
      return NextResponse.json({ error: 'Failed to duplicate draft' }, { status: 500 });
    }

    // Create initial version (v1) with the copied content
    await admin.from('proposal_draft_versions').insert({
      draft_id: draft.id,
      version_number: 1,
      version_name: `Duplicated from ${source.title}`.slice(0, 200),
      edit_summary: null,
      content: {
        title: newTitle,
        abstract: source.abstract,
        motivation: source.motivation,
        rationale: source.rationale,
        proposalType: source.proposal_type,
        typeSpecific: source.type_specific ?? {},
      },
    });

    captureServerEvent(
      'author_draft_duplicated',
      {
        draft_id: draft.id,
        source_draft_id: draftId,
        proposal_type: source.proposal_type,
        is_self_duplicate: body.stakeAddress === source.owner_stake_address,
      },
      body.stakeAddress,
    );

    return NextResponse.json({ draft: mapDraftRow(draft) }, { status: 201 });
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
    lastConstitutionalCheck: row.last_constitutional_check ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
