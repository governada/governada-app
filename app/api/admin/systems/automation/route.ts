export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { SystemsAutomationFollowupStatus } from '@/lib/admin/systems';
import { BASE_URL } from '@/lib/constants';
import { sendFounderNotification } from '@/lib/founderNotifications';
import { buildSystemsDashboardData } from '@/lib/admin/systemsDashboard';
import {
  buildSystemsCommitmentShepherdRecord,
  buildSystemsCommitmentShepherdTarget,
  buildLatestSuccessfulEscalationBySource,
  buildSystemsAutomationSpecs,
  buildSystemsAutomationState,
  buildSystemsOperatorEscalationTargets,
  followupMatchesSpec,
  formatSystemsOperatorEscalationDigest,
  summarizeSystemsAutomationRun,
  SYSTEMS_AUTOMATION_AUDIT_ACTIONS,
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
  SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
  SYSTEMS_OPERATOR_ESCALATION_ACTION,
} from '@/lib/admin/systemsAutomation';

type AutomationActor = {
  actor: string;
  actorType: 'manual' | 'cron';
};

function resolveAutomationActor(request: NextRequest, ctx: RouteContext): AutomationActor | null {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return { actor: 'system:systems-automation', actorType: 'cron' };
  }

  if (ctx.wallet && isAdminWallet(ctx.wallet)) {
    return { actor: ctx.wallet, actorType: 'manual' };
  }

  return null;
}

async function fetchAutomationAuditRows() {
  const supabase = getSupabaseAdmin();
  return supabase
    .from('admin_audit_log')
    .select('action, target, payload, created_at')
    .in('action', [...SYSTEMS_AUTOMATION_AUDIT_ACTIONS])
    .order('created_at', { ascending: false })
    .limit(200);
}

export async function runSystemsAutomationSweep(request: NextRequest, ctx: RouteContext) {
  const actor = resolveAutomationActor(request, ctx);
  if (!actor) {
    const status = ctx.wallet ? 403 : 401;
    const error = ctx.wallet ? 'Forbidden' : 'Unauthorized';
    return NextResponse.json({ error }, { status });
  }

  const [dashboard, auditRowsResult] = await Promise.all([
    buildSystemsDashboardData(),
    fetchAutomationAuditRows(),
  ]);

  if (auditRowsResult.error) {
    return NextResponse.json({ error: 'Failed to load automation audit history' }, { status: 500 });
  }

  const auditRows = auditRowsResult.data || [];
  const currentState = buildSystemsAutomationState(auditRows);
  const latestEscalationBySource = buildLatestSuccessfulEscalationBySource(auditRows);
  const currentByKey = new Map(
    currentState.allFollowups.map((followup) => [followup.sourceKey, followup]),
  );
  const nextByKey = new Map(currentByKey);
  const specs = buildSystemsAutomationSpecs({
    reviewDiscipline: dashboard.reviewDiscipline,
    incidentSummary: dashboard.incidentSummary,
    incidentHistory: dashboard.incidentHistory,
    openCommitments: dashboard.automationOpenCommitments,
    actions: dashboard.actions,
  });

  const activeKeys = new Set<string>();
  const followupRows: Array<Record<string, unknown>> = [];
  let openedCount = 0;
  let updatedCount = 0;
  let resolvedCount = 0;

  for (const spec of specs) {
    activeKeys.add(spec.sourceKey);
    const current = currentByKey.get(spec.sourceKey);
    const desiredStatus: SystemsAutomationFollowupStatus =
      current?.status === 'acknowledged' ? 'acknowledged' : 'open';

    if (!followupMatchesSpec(current, spec, desiredStatus)) {
      const payload = {
        sourceKey: spec.sourceKey,
        triggerType: spec.triggerType,
        severity: spec.severity,
        status: desiredStatus,
        title: spec.title,
        summary: spec.summary,
        recommendedAction: spec.recommendedAction,
        actionHref: spec.actionHref ?? null,
        evidence: spec.evidence ?? {},
      };

      followupRows.push({
        user_id: actor.actor,
        action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
        target: spec.sourceKey,
        payload,
      });

      if (!current || current.status === 'resolved') openedCount += 1;
      else updatedCount += 1;

      nextByKey.set(spec.sourceKey, {
        ...payload,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  for (const current of currentState.allFollowups) {
    if (activeKeys.has(current.sourceKey) || current.status === 'resolved') continue;

    const payload = {
      sourceKey: current.sourceKey,
      triggerType: current.triggerType,
      severity: current.severity,
      status: 'resolved' as const,
      title: current.title,
      summary: current.summary,
      recommendedAction: current.recommendedAction,
      actionHref: current.actionHref ?? null,
      evidence: current.evidence ?? {},
    };

    followupRows.push({
      user_id: actor.actor,
      action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
      target: current.sourceKey,
      payload,
    });

    resolvedCount += 1;
    nextByKey.set(current.sourceKey, {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  }

  const supabase = getSupabaseAdmin();

  if (followupRows.length > 0) {
    const { error } = await supabase.from('admin_audit_log').insert(followupRows);
    if (error) {
      return NextResponse.json(
        { error: 'Failed to persist automation follow-ups' },
        { status: 500 },
      );
    }
  }

  const nextOpenFollowups = Array.from(nextByKey.values())
    .filter((followup) => followup.status !== 'resolved')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const runSummary = summarizeSystemsAutomationRun(nextOpenFollowups);

  const { error: runError } = await supabase.from('admin_audit_log').insert({
    user_id: actor.actor,
    action: SYSTEMS_AUTOMATION_SWEEP_ACTION,
    target: 'systems',
    payload: {
      actorType: actor.actorType,
      status: runSummary.status,
      summary: runSummary.summary,
      followupCount: nextOpenFollowups.length,
      criticalCount: runSummary.criticalCount,
      openedCount,
      updatedCount,
      resolvedCount,
    },
  });

  if (runError) {
    return NextResponse.json({ error: 'Failed to record automation sweep' }, { status: 500 });
  }

  const commitmentShepherdTarget = buildSystemsCommitmentShepherdTarget(
    dashboard.automationOpenCommitments,
  );
  const commitmentShepherd = buildSystemsCommitmentShepherdRecord(
    commitmentShepherdTarget,
    actor.actorType,
  );

  const { error: shepherdError } = await supabase.from('admin_audit_log').insert({
    user_id: actor.actor,
    action: SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
    target: commitmentShepherdTarget?.commitmentId ?? 'systems',
    payload: commitmentShepherd,
  });

  if (shepherdError) {
    return NextResponse.json(
      { error: 'Failed to record commitment shepherd state' },
      { status: 500 },
    );
  }

  const baseUrl = BASE_URL.startsWith('http://localhost') ? 'https://governada.io' : BASE_URL;
  const escalationTargets = buildSystemsOperatorEscalationTargets(
    nextOpenFollowups,
    latestEscalationBySource,
  );

  let operatorEscalation: {
    status: 'sent' | 'failed';
    criticalCount: number;
    channelCount: number;
  } | null = null;

  if (escalationTargets.length > 0) {
    const digest = formatSystemsOperatorEscalationDigest(escalationTargets, baseUrl);
    const delivery = await sendFounderNotification({
      level: 'escalation',
      title: digest.title,
      details: digest.details,
    });

    operatorEscalation = {
      status: delivery.ok ? 'sent' : 'failed',
      criticalCount: escalationTargets.length,
      channelCount: delivery.channelCount,
    };

    const { error: escalationError } = await supabase.from('admin_audit_log').insert({
      user_id: actor.actor,
      action: SYSTEMS_OPERATOR_ESCALATION_ACTION,
      target: 'systems',
      payload: {
        actorType: actor.actorType,
        status: delivery.ok ? 'sent' : 'failed',
        title: digest.title,
        details: delivery.ok
          ? digest.details
          : `${digest.details}\n\nDelivery failure: ${delivery.failureReason ?? 'unknown'}`,
        criticalCount: escalationTargets.length,
        followupSourceKeys: escalationTargets.map((target) => target.sourceKey),
        channelCount: delivery.channelCount,
        channels: delivery.channels,
      },
    });

    if (escalationError) {
      return NextResponse.json({ error: 'Failed to record operator escalation' }, { status: 500 });
    }
  }

  return NextResponse.json({
    status: runSummary.status,
    summary: runSummary.summary,
    followupCount: nextOpenFollowups.length,
    criticalCount: runSummary.criticalCount,
    openedCount,
    updatedCount,
    resolvedCount,
    commitmentShepherd,
    operatorEscalation,
  });
}

export const GET = withRouteHandler(runSystemsAutomationSweep, {
  auth: 'optional',
  rateLimit: { max: 12, window: 60 },
});

export const POST = withRouteHandler(runSystemsAutomationSweep, {
  auth: 'optional',
  rateLimit: { max: 12, window: 60 },
});
