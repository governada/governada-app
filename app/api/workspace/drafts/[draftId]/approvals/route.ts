/**
 * Team Approvals API — manage team member approvals for proposal submission.
 *
 * GET  /api/workspace/drafts/[draftId]/approvals
 *   Returns approval status for all editor-role team members.
 *
 * POST /api/workspace/drafts/[draftId]/approvals
 *   Records the current user's approval. Idempotent (re-approval is no-op).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDraftId(pathname: string): string | null {
  const match = pathname.match(/\/drafts\/([^/]+)\/approvals/);
  return match?.[1] ?? null;
}

interface TeamApproval {
  memberId: string;
  stakeAddress: string;
  role: string;
  approvedAt: string | null;
}

// ---------------------------------------------------------------------------
// GET — list approvals for a draft
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const draftId = extractDraftId(request.nextUrl.pathname);
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch team for this draft
    const { data: teamRow } = await admin
      .from('proposal_teams')
      .select('id')
      .eq('draft_id', draftId)
      .maybeSingle();

    // No team — solo proposer, all approved by default
    if (!teamRow) {
      return NextResponse.json({
        approvals: [] as TeamApproval[],
        allApproved: true,
        pendingCount: 0,
      });
    }

    // Fetch team members (only editors need to approve)
    const { data: members } = await admin
      .from('proposal_team_members')
      .select('id, stake_address, role')
      .eq('team_id', teamRow.id);

    const editors = (members ?? []).filter((m) => m.role === 'editor');

    // No editors — only lead/viewers, all approved
    if (editors.length === 0) {
      return NextResponse.json({
        approvals: [] as TeamApproval[],
        allApproved: true,
        pendingCount: 0,
      });
    }

    // Fetch existing approvals
    const editorIds = editors.map((e) => e.id);
    const { data: approvalRows } = await admin
      .from('proposal_team_approvals')
      .select('team_member_id, approved_at')
      .eq('draft_id', draftId)
      .in('team_member_id', editorIds);

    const approvalMap = new Map<string, string>();
    for (const row of approvalRows ?? []) {
      approvalMap.set(row.team_member_id, row.approved_at);
    }

    const approvals: TeamApproval[] = editors.map((e) => ({
      memberId: e.id,
      stakeAddress: e.stake_address,
      role: e.role,
      approvedAt: approvalMap.get(e.id) ?? null,
    }));

    const pendingCount = approvals.filter((a) => !a.approvedAt).length;

    return NextResponse.json({
      approvals,
      allApproved: pendingCount === 0,
      pendingCount,
    });
  },
  { auth: 'optional' },
);

// ---------------------------------------------------------------------------
// POST — record approval for the current user
// ---------------------------------------------------------------------------

export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const draftId = extractDraftId(request.nextUrl.pathname);
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const body = await request.json();
    const stakeAddress: string | undefined = body?.stakeAddress;
    if (!stakeAddress) {
      return NextResponse.json({ error: 'Missing stakeAddress' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Find the team for this draft
    const { data: teamRow } = await admin
      .from('proposal_teams')
      .select('id')
      .eq('draft_id', draftId)
      .maybeSingle();

    if (!teamRow) {
      return NextResponse.json({ error: 'No team exists for this draft' }, { status: 404 });
    }

    // Find the team member by stake address
    const { data: member } = await admin
      .from('proposal_team_members')
      .select('id, role')
      .eq('team_id', teamRow.id)
      .eq('stake_address', stakeAddress)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this team' }, { status: 403 });
    }

    if (member.role !== 'editor') {
      return NextResponse.json(
        { error: 'Only editors need to approve. Leads have implicit approval.' },
        { status: 400 },
      );
    }

    // Idempotent upsert — if already approved, just return existing
    const { data: existing } = await admin
      .from('proposal_team_approvals')
      .select('approved_at')
      .eq('draft_id', draftId)
      .eq('team_member_id', member.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, approvedAt: existing.approved_at });
    }

    // Insert new approval
    const { data: approval, error: insertError } = await admin
      .from('proposal_team_approvals')
      .insert({
        draft_id: draftId,
        team_member_id: member.id,
      })
      .select('approved_at')
      .single();

    if (insertError || !approval) {
      return NextResponse.json({ error: 'Failed to record approval' }, { status: 500 });
    }

    captureServerEvent(
      'team_approval_recorded',
      {
        draft_id: draftId,
        team_member_id: member.id,
        stake_address: stakeAddress,
      },
      ctx.wallet ?? stakeAddress,
    );

    return NextResponse.json({ success: true, approvedAt: approval.approved_at });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);
