/**
 * Team Members API — update roles and remove members from a proposal team.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { UpdateMemberRoleSchema, RemoveMemberSchema } from '@/lib/api/schemas/workspace';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

/** PATCH /api/workspace/teams/members — update a member's role */
export const PATCH = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const body = UpdateMemberRoleSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch the target member
    const { data: targetMember } = await admin
      .from('proposal_team_members')
      .select('*')
      .eq('id', body.memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot change the lead's role
    if (targetMember.role === 'lead') {
      return NextResponse.json({ error: 'Cannot change the lead role' }, { status: 403 });
    }

    // Verify the caller is the team lead
    const { data: callerMember } = await admin
      .from('proposal_team_members')
      .select('role')
      .eq('team_id', targetMember.team_id)
      .eq('stake_address', ctx.wallet!)
      .single();

    if (!callerMember || callerMember.role !== 'lead') {
      return NextResponse.json({ error: 'Only the team lead can change roles' }, { status: 403 });
    }

    const { error } = await admin
      .from('proposal_team_members')
      .update({ role: body.role })
      .eq('id', body.memberId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    captureServerEvent('team_member_role_changed', {
      team_id: targetMember.team_id,
      member_id: body.memberId,
      new_role: body.role,
    });

    return NextResponse.json({ success: true });
  },
  { auth: 'required' },
);

/** DELETE /api/workspace/teams/members — remove a member (lead or self-remove) */
export const DELETE = withRouteHandler(
  async (request: NextRequest, ctx) => {
    const body = RemoveMemberSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    // Fetch the target member
    const { data: targetMember } = await admin
      .from('proposal_team_members')
      .select('*')
      .eq('id', body.memberId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot remove the lead
    if (targetMember.role === 'lead') {
      return NextResponse.json({ error: 'Cannot remove the team lead' }, { status: 403 });
    }

    // Caller must be the team lead OR the member themselves (self-remove)
    const isSelf = targetMember.stake_address === ctx.wallet;
    if (!isSelf) {
      const { data: callerMember } = await admin
        .from('proposal_team_members')
        .select('role')
        .eq('team_id', targetMember.team_id)
        .eq('stake_address', ctx.wallet!)
        .single();

      if (!callerMember || callerMember.role !== 'lead') {
        return NextResponse.json(
          { error: 'Only the team lead or the member themselves can remove a member' },
          { status: 403 },
        );
      }
    }

    const { error } = await admin.from('proposal_team_members').delete().eq('id', body.memberId);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    captureServerEvent('team_member_removed', {
      team_id: targetMember.team_id,
      member_id: body.memberId,
      self_remove: isSelf,
    });

    return NextResponse.json({ success: true });
  },
  { auth: 'required' },
);
