export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildSystemsAutomationState,
  SYSTEMS_AUTOMATION_AUDIT_ACTIONS,
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  updateSystemsAutomationFollowupSchema,
} from '@/lib/admin/systemsAutomation';

export const PATCH = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = updateSystemsAutomationFollowupSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();
    const auditRowsResult = await supabase
      .from('admin_audit_log')
      .select('action, target, payload, created_at')
      .in('action', [...SYSTEMS_AUTOMATION_AUDIT_ACTIONS])
      .order('created_at', { ascending: false })
      .limit(200);

    if (auditRowsResult.error) {
      return NextResponse.json({ error: 'Failed to load automation follow-ups' }, { status: 500 });
    }

    const state = buildSystemsAutomationState(auditRowsResult.data || []);
    const current = state.allFollowups.find((followup) => followup.sourceKey === body.sourceKey);

    if (!current) {
      return NextResponse.json({ error: 'Automation follow-up not found' }, { status: 404 });
    }

    if (current.status === body.status) {
      return NextResponse.json(current);
    }

    const payload = {
      sourceKey: current.sourceKey,
      triggerType: current.triggerType,
      severity: current.severity,
      status: body.status,
      title: current.title,
      summary: current.summary,
      recommendedAction: current.recommendedAction,
      actionHref: current.actionHref ?? null,
      evidence: current.evidence ?? {},
    };

    const { error } = await supabase.from('admin_audit_log').insert({
      user_id: ctx.wallet!,
      action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
      target: current.sourceKey,
      payload,
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to update automation follow-up' }, { status: 500 });
    }

    return NextResponse.json({
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
