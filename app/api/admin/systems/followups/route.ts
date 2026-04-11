export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
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
    const { data: current, error: currentError } = await supabase
      .from('systems_automation_followups')
      .select(
        'source_key, trigger_type, severity, status, title, summary, recommended_action, action_href, evidence, acknowledged_at, resolved_at',
      )
      .eq('source_key', body.sourceKey)
      .single();

    if (currentError || !current) {
      return NextResponse.json({ error: 'Automation follow-up not found' }, { status: 404 });
    }

    if (current.status === body.status) {
      return NextResponse.json({
        sourceKey: current.source_key,
        triggerType: current.trigger_type,
        severity: current.severity,
        status: current.status,
        title: current.title,
        summary: current.summary,
        recommendedAction: current.recommended_action,
        actionHref: current.action_href,
        evidence: current.evidence ?? {},
      });
    }

    const now = new Date().toISOString();
    const payload = {
      sourceKey: current.source_key,
      triggerType: current.trigger_type,
      severity: current.severity,
      status: body.status,
      title: current.title,
      summary: current.summary,
      recommendedAction: current.recommended_action,
      actionHref: current.action_href ?? null,
      evidence: current.evidence ?? {},
    };

    const { error: updateError } = await supabase
      .from('systems_automation_followups')
      .update({
        status: body.status,
        acknowledged_at:
          body.status === 'acknowledged'
            ? (current.acknowledged_at ?? now)
            : body.status === 'open'
              ? null
              : current.acknowledged_at,
        resolved_at: body.status === 'resolved' ? now : null,
        last_surfaced_at: body.status === 'open' ? now : undefined,
      })
      .eq('source_key', body.sourceKey);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update automation follow-up' }, { status: 500 });
    }

    const { error } = await supabase.from('admin_audit_log').insert({
      user_id: ctx.wallet!,
      action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
      target: current.source_key,
      payload,
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to update automation follow-up' }, { status: 500 });
    }

    return NextResponse.json({
      ...payload,
      updatedAt: now,
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
