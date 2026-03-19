/**
 * Transfer Draft Ownership API — transfer a draft to a new owner.
 *
 * PATCH /api/workspace/drafts/[draftId]/transfer
 * Body: { currentOwnerStakeAddress: string, newOwnerStakeAddress: string }
 * Returns: { draft: ProposalDraft }
 *
 * Transfers ownership and updates team roles accordingly:
 * - Old owner's team role changes from 'lead' to 'editor'
 * - New owner becomes 'lead' (added to team if not already a member)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { TransferDraftSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import type { ProposalDraft } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

function extractDraftId(pathname: string): string | null {
  const match = pathname.match(/\/drafts\/([^/]+)\/transfer/);
  return match?.[1] ?? null;
}

export const PATCH = withRouteHandler(
  async (request: NextRequest) => {
    const draftId = extractDraftId(request.nextUrl.pathname);
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = TransferDraftSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch the draft
    const { data: draft, error: fetchError } = await admin
      .from('proposal_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Verify current owner matches
    if (draft.owner_stake_address !== body.currentOwnerStakeAddress) {
      return NextResponse.json(
        { error: 'Only the current owner can transfer ownership' },
        { status: 403 },
      );
    }

    // Block transfer of submitted or archived drafts
    if (draft.status === 'submitted' || draft.status === 'archived') {
      return NextResponse.json(
        { error: `Cannot transfer a draft in '${draft.status}' status` },
        { status: 400 },
      );
    }

    // Prevent transfer to self
    if (body.currentOwnerStakeAddress === body.newOwnerStakeAddress) {
      return NextResponse.json({ error: 'Cannot transfer to the same owner' }, { status: 400 });
    }

    // Update ownership
    const { data: updated, error: updateError } = await admin
      .from('proposal_drafts')
      .update({
        owner_stake_address: body.newOwnerStakeAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId)
      .select()
      .single();

    if (updateError || !updated) {
      logger.error('[transfer] Failed to transfer draft ownership', {
        error: updateError?.message,
        draftId,
      });
      return NextResponse.json({ error: 'Failed to transfer draft' }, { status: 500 });
    }

    // Update team roles if a team exists
    const { data: team } = await admin
      .from('proposal_teams')
      .select('id')
      .eq('draft_id', draftId)
      .maybeSingle();

    if (team) {
      // Demote old owner from 'lead' to 'editor'
      await admin
        .from('proposal_team_members')
        .update({ role: 'editor' })
        .eq('team_id', team.id)
        .eq('stake_address', body.currentOwnerStakeAddress)
        .eq('role', 'lead');

      // Check if new owner is already a team member
      const { data: existingMember } = await admin
        .from('proposal_team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('stake_address', body.newOwnerStakeAddress)
        .maybeSingle();

      if (existingMember) {
        // Promote existing member to 'lead'
        await admin
          .from('proposal_team_members')
          .update({ role: 'lead' })
          .eq('id', existingMember.id);
      } else {
        // Add new owner as 'lead' team member
        await admin.from('proposal_team_members').insert({
          team_id: team.id,
          stake_address: body.newOwnerStakeAddress,
          role: 'lead',
          joined_at: new Date().toISOString(),
        });
      }
    }

    captureServerEvent(
      'author_draft_transferred',
      {
        draft_id: draftId,
        from_owner: body.currentOwnerStakeAddress,
        to_owner: body.newOwnerStakeAddress,
        has_team: !!team,
      },
      body.currentOwnerStakeAddress,
    );

    return NextResponse.json({ draft: mapDraftRow(updated) });
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
