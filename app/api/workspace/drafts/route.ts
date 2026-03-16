/**
 * Proposal Drafts API — list and create drafts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CreateDraftSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { ProposalDraft } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

/** GET /api/workspace/drafts?stakeAddress=... — list drafts for a user */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
  if (!stakeAddress) {
    return NextResponse.json({ error: 'Missing stakeAddress' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
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
        type_specific: body.typeSpecific ?? null,
        status: 'draft',
        current_version: 1,
      })
      .select()
      .single();

    if (draftError || !draft) {
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
        typeSpecific: body.typeSpecific ?? null,
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
