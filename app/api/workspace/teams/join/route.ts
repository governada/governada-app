/**
 * Team Join API — claim an invite and join a proposal team.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { JoinTeamSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

/** POST /api/workspace/teams/join — claim an invite code and join the team */
export const POST = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const body = JoinTeamSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Look up the invite
    const { data: invite, error: inviteErr } = await admin
      .from('proposal_team_invites')
      .select('*')
      .eq('invite_code', body.inviteCode)
      .single();

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Validate invite is still usable
    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
    }

    if (invite.use_count >= invite.max_uses) {
      return NextResponse.json({ error: 'Invite has reached maximum uses' }, { status: 410 });
    }

    // Check if user is already a member
    const { data: existing } = await admin
      .from('proposal_team_members')
      .select('id')
      .eq('team_id', invite.team_id)
      .eq('stake_address', ctx.wallet!)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Already a team member' }, { status: 409 });
    }

    // Add the member
    const now = new Date().toISOString();
    const { error: memberErr } = await admin.from('proposal_team_members').insert({
      team_id: invite.team_id,
      user_id: ctx.userId ?? null,
      stake_address: ctx.wallet!,
      role: invite.role,
      invited_at: now,
      joined_at: now,
    });

    if (memberErr) {
      return NextResponse.json({ error: 'Failed to join team' }, { status: 500 });
    }

    // Increment use count
    await admin
      .from('proposal_team_invites')
      .update({ use_count: invite.use_count + 1 })
      .eq('id', invite.id);

    captureServerEvent('team_member_joined', {
      team_id: invite.team_id,
      role: invite.role,
    });

    return NextResponse.json({ success: true, teamId: invite.team_id });
  },
  { auth: 'required' },
);
