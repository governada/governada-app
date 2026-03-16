/**
 * Team Invite API — generate invite links for proposal team collaboration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InviteMemberSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';
import type { TeamInvite } from '@/lib/workspace/types';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/** POST /api/workspace/teams/invite — generate an invite code */
export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const body = InviteMemberSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Verify the caller is the team lead
    const { data: member } = await admin
      .from('proposal_team_members')
      .select('role')
      .eq('team_id', body.teamId)
      .eq('stake_address', ctx.wallet!)
      .single();

    if (!member || member.role !== 'lead') {
      return NextResponse.json({ error: 'Only the team lead can create invites' }, { status: 403 });
    }

    const inviteCode = randomUUID();
    const expiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000).toISOString();

    const { data: inviteRow, error } = await admin
      .from('proposal_team_invites')
      .insert({
        team_id: body.teamId,
        invite_code: inviteCode,
        role: body.role,
        expires_at: expiresAt,
        max_uses: body.maxUses,
        use_count: 0,
        created_by: ctx.wallet!,
      })
      .select()
      .single();

    if (error || !inviteRow) {
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
    }

    captureServerEvent('team_member_invited', {
      team_id: body.teamId,
      role: body.role,
      expires_in_hours: body.expiresInHours,
      max_uses: body.maxUses,
    });

    return NextResponse.json({ invite: mapInviteRow(inviteRow) });
  },
  { auth: 'required' },
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapInviteRow(row: any): TeamInvite {
  return {
    id: row.id,
    teamId: row.team_id,
    inviteCode: row.invite_code,
    role: row.role,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
