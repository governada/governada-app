/**
 * Proposal Teams API — create and fetch teams for collaborative draft authoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CreateTeamSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { ProposalTeam, TeamMember } from '@/lib/workspace/types';

export const dynamic = 'force-dynamic';

/** GET /api/workspace/teams?draftId=... — fetch team + members for a draft */
export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const draftId = request.nextUrl.searchParams.get('draftId');
    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId query param' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: teamRow, error: teamErr } = await admin
      .from('proposal_teams')
      .select('*')
      .eq('draft_id', draftId)
      .maybeSingle();

    if (teamErr) {
      return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
    }

    if (!teamRow) {
      return NextResponse.json({ team: null, members: [] });
    }

    const { data: memberRows } = await admin
      .from('proposal_team_members')
      .select('*')
      .eq('team_id', teamRow.id)
      .order('invited_at', { ascending: true });

    return NextResponse.json({
      team: mapTeamRow(teamRow),
      members: (memberRows ?? []).map(mapMemberRow),
    });
  },
  { auth: 'optional' },
);

/** POST /api/workspace/teams — create a team for a draft */
export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const body = CreateTeamSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Verify the caller owns this draft
    const { data: draft } = await admin
      .from('proposal_drafts')
      .select('owner_stake_address')
      .eq('id', body.draftId)
      .single();

    if (!draft || draft.owner_stake_address !== ctx.wallet) {
      return NextResponse.json({ error: 'Not the draft owner' }, { status: 403 });
    }

    // Check no team exists already
    const { data: existing } = await admin
      .from('proposal_teams')
      .select('id')
      .eq('draft_id', body.draftId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Team already exists for this draft' }, { status: 409 });
    }

    // Create team
    const { data: teamRow, error: teamErr } = await admin
      .from('proposal_teams')
      .insert({
        draft_id: body.draftId,
        name: body.name || 'Proposal Team',
      })
      .select()
      .single();

    if (teamErr || !teamRow) {
      return NextResponse.json({ error: 'Failed to create team' }, { status: 500 });
    }

    // Auto-add creator as lead
    const { data: memberRow } = await admin
      .from('proposal_team_members')
      .insert({
        team_id: teamRow.id,
        user_id: ctx.userId ?? null,
        stake_address: ctx.wallet!,
        role: 'lead',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    captureServerEvent('team_created', {
      team_id: teamRow.id,
      draft_id: body.draftId,
    });

    return NextResponse.json({
      team: mapTeamRow(teamRow),
      members: memberRow ? [mapMemberRow(memberRow)] : [],
    });
  },
  { auth: 'required' },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapTeamRow(row: any): ProposalTeam {
  return {
    id: row.id,
    draftId: row.draft_id,
    name: row.name ?? '',
    createdAt: row.created_at,
  };
}

function mapMemberRow(row: any): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id ?? null,
    stakeAddress: row.stake_address,
    role: row.role,
    invitedAt: row.invited_at ?? row.created_at,
    joinedAt: row.joined_at ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
