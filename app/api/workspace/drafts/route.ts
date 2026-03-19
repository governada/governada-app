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
import { SANDBOX_DESCRIPTION_PREFIX } from '@/lib/admin/sandbox';
import type { ProposalDraft, TeamRole } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspace/drafts?stakeAddress=... — list drafts for a user
 * GET /api/workspace/drafts?status=community_review,final_comment — list community-reviewable drafts
 */
/** Response type for drafts where the user is a team member */
interface ProposalDraftWithRole extends ProposalDraft {
  memberRole?: TeamRole;
}

export const GET = withRouteHandler(async (request: NextRequest) => {
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
  const statusFilter = request.nextUrl.searchParams.get('status');
  const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
  const memberOf = request.nextUrl.searchParams.get('memberOf');

  const admin = getSupabaseAdmin();

  // Sandbox support: if sandbox header present, scope reads to that cohort
  const sandboxCohortId = request.headers.get('x-sandbox-cohort') || null;

  // ---------------------------------------------------------------------------
  // Team membership mode: fetch drafts where user is a team member (not owner)
  // ---------------------------------------------------------------------------
  if (memberOf) {
    // Step 1: Get team memberships for this user
    const { data: memberships, error: memberError } = await admin
      .from('proposal_team_members')
      .select('team_id, role')
      .eq('stake_address', memberOf);

    if (memberError) {
      return NextResponse.json({ error: 'Failed to fetch team memberships' }, { status: 500 });
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ drafts: [] });
    }

    // Step 2: Get draft IDs from those teams
    const teamIds = memberships.map((m) => m.team_id);
    const { data: teams, error: teamsError } = await admin
      .from('proposal_teams')
      .select('id, draft_id')
      .in('id', teamIds);

    if (teamsError || !teams || teams.length === 0) {
      return NextResponse.json({ drafts: [] });
    }

    // Build team_id -> draft_id + role mapping
    const teamToDraft = new Map(teams.map((t) => [t.id, t.draft_id]));
    const draftRoles = new Map<string, TeamRole>();
    for (const m of memberships) {
      const draftId = teamToDraft.get(m.team_id);
      if (draftId) {
        draftRoles.set(draftId, m.role as TeamRole);
      }
    }

    const draftIds = [...draftRoles.keys()];

    // Step 3: Fetch those drafts (exclude ones owned by the requester)
    let memberQuery = admin
      .from('proposal_drafts')
      .select('*')
      .in('id', draftIds)
      .neq('owner_stake_address', memberOf);

    if (!includeArchived) {
      memberQuery = memberQuery.neq('status', 'archived');
    }

    const { data, error } = await memberQuery.order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch team drafts' }, { status: 500 });
    }

    const drafts: ProposalDraftWithRole[] = (data ?? []).map((row) => ({
      ...mapDraftRow(row),
      memberRole: draftRoles.get(row.id) ?? undefined,
    }));

    return NextResponse.json({ drafts });
  }

  // ---------------------------------------------------------------------------
  // Community-reviewable drafts mode: fetch by status (no owner filter)
  // ---------------------------------------------------------------------------
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

    if (sandboxCohortId) {
      // Sandbox mode: see sandbox cohort's drafts + real drafts
      query = query.or(`preview_cohort_id.eq.${sandboxCohortId},preview_cohort_id.is.null`);
    } else if (previewCohortId) {
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

    // Check if a reviewer stake address was provided for "your review status"
    const reviewerStakeAddress = request.nextUrl.searchParams.get('reviewerStakeAddress');

    let drafts: ProposalDraft[] = (data ?? []).map(mapDraftRow);

    // If reviewer address provided, enrich each draft with the reviewer's review status
    if (reviewerStakeAddress && drafts.length > 0) {
      const draftIds = drafts.map((d) => d.id);
      const { data: reviewerReviews } = await admin
        .from('draft_reviews')
        .select('draft_id, reviewed_at_version')
        .eq('reviewer_stake_address', reviewerStakeAddress)
        .in('draft_id', draftIds);

      // Build a map of draft_id -> reviewer's review
      const reviewMap = new Map<string, { reviewedAtVersion: number | null }>();
      for (const r of reviewerReviews ?? []) {
        reviewMap.set(r.draft_id, {
          reviewedAtVersion: (r.reviewed_at_version as number | null) ?? null,
        });
      }

      drafts = drafts.map((draft) => {
        const review = reviewMap.get(draft.id);
        if (!review) {
          return { ...draft, yourReviewStatus: 'none' as const };
        }
        // Stale if reviewed_at_version is known and less than current version
        const isStale =
          review.reviewedAtVersion !== null && review.reviewedAtVersion < draft.currentVersion;
        return {
          ...draft,
          yourReviewStatus: isStale ? ('stale' as const) : ('reviewed' as const),
        };
      });
    }

    return NextResponse.json({ drafts });
  }

  // ---------------------------------------------------------------------------
  // Owner-specific drafts mode
  // ---------------------------------------------------------------------------
  if (!stakeAddress) {
    return NextResponse.json({ error: 'Missing stakeAddress or status' }, { status: 400 });
  }

  let ownerQuery = admin.from('proposal_drafts').select('*');

  if (!includeArchived) {
    ownerQuery = ownerQuery.neq('status', 'archived');
  }

  if (sandboxCohortId) {
    // Sandbox mode: show drafts owned by this persona OR any draft in the sandbox cohort.
    // This allows cross-persona visibility — drafts created as "Citizen" are visible
    // when the admin switches to "DRep" within the same sandbox.
    ownerQuery = ownerQuery.or(
      `owner_stake_address.eq.${stakeAddress},preview_cohort_id.eq.${sandboxCohortId}`,
    );
  } else {
    ownerQuery = ownerQuery.eq('owner_stake_address', stakeAddress);
  }

  const { data, error } = await ownerQuery.order('updated_at', { ascending: false });

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

    // Sandbox support: scope writes to preview cohort if sandbox header present
    const sandboxCohortId = request.headers.get('x-sandbox-cohort') || null;

    // Block writes during impersonation (unless sandbox is active)
    const impersonateHeader = request.headers.get('x-impersonating');
    if (impersonateHeader === 'true' && !sandboxCohortId) {
      return NextResponse.json(
        {
          error:
            'Writes are blocked during impersonation. Enter sandbox mode to test changes safely.',
        },
        { status: 403 },
      );
    }

    // Determine preview cohort: sandbox header takes precedence, then preview address
    let previewCohortId: string | null = null;

    if (sandboxCohortId) {
      // Verify the cohort exists and is an admin sandbox
      const { data: sandboxCohort } = await admin
        .from('preview_cohorts')
        .select('id, description')
        .eq('id', sandboxCohortId)
        .maybeSingle();

      if (sandboxCohort?.description?.startsWith(SANDBOX_DESCRIPTION_PREFIX)) {
        previewCohortId = sandboxCohortId;
      }
    } else if (isPreviewAddress(body.stakeAddress)) {
      // Tag preview drafts with the user's cohort so cohort members can see them
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
/* eslint-enable @typescript-eslint/no-explicit-any */
