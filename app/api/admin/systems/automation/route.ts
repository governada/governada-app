export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import type {
  SystemsAutomationFollowup,
  SystemsAutomationFollowupStatus,
  SystemsOperatorEscalationRecord,
} from '@/lib/admin/systems';
import { BASE_URL } from '@/lib/constants';
import { sendFounderNotification } from '@/lib/founderNotifications';
import { buildSystemsDashboardData } from '@/lib/admin/systemsDashboard';
import {
  buildSystemsCommitmentShepherdRecord,
  buildSystemsCommitmentShepherdTarget,
  buildSystemsAutomationSpecs,
  buildSystemsOperatorEscalationTargets,
  followupMatchesSpec,
  formatSystemsOperatorEscalationDigest,
  summarizeSystemsAutomationRun,
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
  SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
  SYSTEMS_OPERATOR_ESCALATION_ACTION,
} from '@/lib/admin/systemsAutomation';

type AutomationActor = {
  actor: string;
  actorType: 'manual' | 'cron';
};

type DurableAutomationFollowupRow = {
  source_key: string;
  trigger_type: SystemsAutomationFollowup['triggerType'];
  severity: SystemsAutomationFollowup['severity'];
  status: SystemsAutomationFollowup['status'];
  title: string;
  summary: string;
  recommended_action: string;
  action_href: string | null;
  evidence: Record<string, unknown> | null;
  linked_incident_id: string | null;
  linked_commitment_id: string | null;
  created_at: string;
  updated_at: string;
  first_opened_at: string;
  last_surfaced_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

type DurableAutomationRunRow = {
  id: string;
  run_key: string;
  actor_type: 'manual' | 'cron';
  actor_wallet_address: string;
  request_id: string | null;
  status: 'running' | 'good' | 'warning' | 'critical' | 'failed';
  summary: string | null;
  followup_count: number;
  critical_count: number;
  opened_count: number;
  updated_count: number;
  resolved_count: number;
  started_at: string;
  completed_at: string | null;
};

type DurableAutomationEscalationRow = {
  id: string;
  run_id: string | null;
  source_key: string;
  reason: 'new' | 'reminder';
  status: 'pending' | 'sent' | 'failed';
  title: string;
  details: string;
  followup_updated_at: string;
  critical_count: number;
  channel_count: number;
  channels: string[] | null;
  created_at: string;
  delivered_at: string | null;
};

type RunAcquisition =
  | { row: DurableAutomationRunRow; resumed: false; alreadyCompleted: false }
  | { row: DurableAutomationRunRow; resumed: true; alreadyCompleted: boolean };

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

function buildRunKey(
  request: NextRequest,
  ctx: RouteContext,
  actorType: AutomationActor['actorType'],
): string {
  const explicit = request.headers.get('x-systems-run-key');
  if (explicit) return explicit;

  if (actorType === 'cron') {
    return `systems:cron:${new Date().toISOString().slice(0, 10)}`;
  }

  return `systems:manual:${ctx.requestId}`;
}

function isConflictError(error: { code?: string; message?: string } | null | undefined) {
  return (
    error?.code === '23505' ||
    (typeof error?.message === 'string' && /duplicate key/i.test(error.message))
  );
}

function toFollowup(row: DurableAutomationFollowupRow): SystemsAutomationFollowup {
  return {
    sourceKey: row.source_key,
    triggerType: row.trigger_type,
    severity: row.severity,
    status: row.status,
    title: row.title,
    summary: row.summary,
    recommendedAction: row.recommended_action,
    actionHref: row.action_href,
    evidence: row.evidence ?? {},
    updatedAt: row.updated_at,
  };
}

function latestSuccessfulEscalationBySource(rows: DurableAutomationEscalationRow[]) {
  const latestBySource = new Map<string, string>();

  for (const row of rows) {
    if (row.status !== 'sent' || latestBySource.has(row.source_key)) continue;
    latestBySource.set(row.source_key, row.delivered_at ?? row.created_at);
  }

  return latestBySource;
}

function linkedIncidentId(
  spec: ReturnType<typeof buildSystemsAutomationSpecs>[number],
  current?: DurableAutomationFollowupRow,
) {
  if (current?.linked_incident_id) return current.linked_incident_id;
  return spec.triggerType === 'incident_retro_followup' &&
    typeof spec.evidence?.entryId === 'string'
    ? spec.evidence.entryId
    : null;
}

function linkedCommitmentId(
  spec: ReturnType<typeof buildSystemsAutomationSpecs>[number],
  current?: DurableAutomationFollowupRow,
) {
  if (current?.linked_commitment_id) return current.linked_commitment_id;
  return spec.triggerType === 'overdue_commitment' &&
    typeof spec.evidence?.commitmentId === 'string'
    ? spec.evidence.commitmentId
    : null;
}

function buildFollowupUpsertRow(input: {
  current?: DurableAutomationFollowupRow;
  spec: ReturnType<typeof buildSystemsAutomationSpecs>[number];
  desiredStatus: SystemsAutomationFollowupStatus;
  now: string;
}) {
  const { current, spec, desiredStatus, now } = input;
  const reopened = !current || current.status === 'resolved';

  return {
    source_key: spec.sourceKey,
    trigger_type: spec.triggerType,
    severity: spec.severity,
    status: desiredStatus,
    title: spec.title,
    summary: spec.summary,
    recommended_action: spec.recommendedAction,
    action_href: spec.actionHref ?? null,
    evidence: spec.evidence ?? {},
    linked_incident_id: linkedIncidentId(spec, current),
    linked_commitment_id: linkedCommitmentId(spec, current),
    created_at: current?.created_at ?? now,
    first_opened_at: reopened ? now : (current?.first_opened_at ?? now),
    last_surfaced_at: now,
    acknowledged_at:
      desiredStatus === 'acknowledged'
        ? (current?.acknowledged_at ?? now)
        : desiredStatus === 'open'
          ? null
          : (current?.acknowledged_at ?? null),
    resolved_at: null,
  };
}

function buildResolvedFollowupRow(current: DurableAutomationFollowupRow, now: string) {
  return {
    source_key: current.source_key,
    trigger_type: current.trigger_type,
    severity: current.severity,
    status: 'resolved' as const,
    title: current.title,
    summary: current.summary,
    recommended_action: current.recommended_action,
    action_href: current.action_href,
    evidence: current.evidence ?? {},
    linked_incident_id: current.linked_incident_id,
    linked_commitment_id: current.linked_commitment_id,
    created_at: current.created_at,
    first_opened_at: current.first_opened_at,
    last_surfaced_at: current.last_surfaced_at,
    acknowledged_at: current.acknowledged_at,
    resolved_at: now,
  };
}

async function acquireAutomationRun(input: {
  runKey: string;
  actor: AutomationActor;
  requestId: string;
  startedAt: string;
}): Promise<RunAcquisition | null> {
  const supabase = getSupabaseAdmin();
  const insertPayload = {
    run_key: input.runKey,
    actor_type: input.actor.actorType,
    actor_wallet_address: input.actor.actor,
    request_id: input.requestId,
    status: 'running' as const,
    started_at: input.startedAt,
  };

  const { data, error } = await supabase
    .from('systems_automation_runs')
    .insert(insertPayload)
    .select(
      'id, run_key, actor_type, actor_wallet_address, request_id, status, summary, followup_count, critical_count, opened_count, updated_count, resolved_count, started_at, completed_at',
    )
    .single();

  if (!error && data) {
    return { row: data as DurableAutomationRunRow, resumed: false, alreadyCompleted: false };
  }

  if (!isConflictError(error)) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from('systems_automation_runs')
    .select(
      'id, run_key, actor_type, actor_wallet_address, request_id, status, summary, followup_count, critical_count, opened_count, updated_count, resolved_count, started_at, completed_at',
    )
    .eq('run_key', input.runKey)
    .single();

  if (existingError || !existing) return null;

  return {
    row: existing as DurableAutomationRunRow,
    resumed: true,
    alreadyCompleted: existing.status !== 'running',
  };
}

function summarizeExistingEscalations(
  rows: DurableAutomationEscalationRow[],
): SystemsOperatorEscalationRecord | { status: 'pending'; criticalCount: number } | null {
  if (rows.length === 0) return null;

  const first = rows[0]!;
  const sentRows = rows.filter((row) => row.status === 'sent');
  if (sentRows.length > 0) {
    return {
      actorType: 'cron',
      status: sentRows.length === rows.length ? 'sent' : 'failed',
      title: first.title,
      details: first.details,
      criticalCount: Math.max(...rows.map((row) => row.critical_count)),
      followupSourceKeys: rows.map((row) => row.source_key),
      channelCount: Math.max(...rows.map((row) => row.channel_count)),
      channels: Array.from(new Set(rows.flatMap((row) => row.channels ?? []))),
      createdAt: first.created_at,
    };
  }

  if (rows.some((row) => row.status === 'pending')) {
    return {
      status: 'pending',
      criticalCount: Math.max(...rows.map((row) => row.critical_count)),
    };
  }

  return {
    actorType: 'cron',
    status: 'failed',
    title: first.title,
    details: first.details,
    criticalCount: Math.max(...rows.map((row) => row.critical_count)),
    followupSourceKeys: rows.map((row) => row.source_key),
    channelCount: Math.max(...rows.map((row) => row.channel_count)),
    channels: Array.from(new Set(rows.flatMap((row) => row.channels ?? []))),
    createdAt: first.created_at,
  };
}

export async function runSystemsAutomationSweep(request: NextRequest, ctx: RouteContext) {
  const actor = resolveAutomationActor(request, ctx);
  if (!actor) {
    const status = ctx.wallet ? 403 : 401;
    const error = ctx.wallet ? 'Forbidden' : 'Unauthorized';
    return NextResponse.json({ error }, { status });
  }

  const startedAt = new Date().toISOString();
  const runKey = buildRunKey(request, ctx, actor.actorType);
  const run = await acquireAutomationRun({
    runKey,
    actor,
    requestId: ctx.requestId,
    startedAt,
  });

  if (!run) {
    return NextResponse.json({ error: 'Failed to initialize automation sweep' }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  const [dashboard, followupsResult, sentEscalationsResult, runEscalationsResult] =
    await Promise.all([
      buildSystemsDashboardData(),
      supabase
        .from('systems_automation_followups')
        .select(
          'source_key, trigger_type, severity, status, title, summary, recommended_action, action_href, evidence, linked_incident_id, linked_commitment_id, created_at, updated_at, first_opened_at, last_surfaced_at, acknowledged_at, resolved_at',
        )
        .order('updated_at', { ascending: false }),
      supabase
        .from('systems_automation_escalations')
        .select(
          'id, run_id, source_key, reason, status, title, details, followup_updated_at, critical_count, channel_count, channels, created_at, delivered_at',
        )
        .eq('status', 'sent')
        .order('created_at', { ascending: false }),
      supabase
        .from('systems_automation_escalations')
        .select(
          'id, run_id, source_key, reason, status, title, details, followup_updated_at, critical_count, channel_count, channels, created_at, delivered_at',
        )
        .eq('run_id', run.row.id)
        .order('created_at', { ascending: false }),
    ]);

  if (followupsResult.error || sentEscalationsResult.error || runEscalationsResult.error) {
    await supabase
      .from('systems_automation_runs')
      .update({
        status: 'failed',
        summary: 'Failed to load durable systems automation state.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.row.id);

    return NextResponse.json({ error: 'Failed to load automation state' }, { status: 500 });
  }

  if (run.alreadyCompleted) {
    const existingEscalationSummary = summarizeExistingEscalations(
      (runEscalationsResult.data || []) as DurableAutomationEscalationRow[],
    );
    const commitmentShepherdTarget = buildSystemsCommitmentShepherdTarget(
      dashboard.automationOpenCommitments,
    );
    const commitmentShepherd = buildSystemsCommitmentShepherdRecord(
      commitmentShepherdTarget,
      actor.actorType,
    );

    return NextResponse.json({
      status: run.row.status,
      summary: run.row.summary ?? 'Automation sweep already completed for this run key.',
      followupCount: run.row.followup_count,
      criticalCount: run.row.critical_count,
      openedCount: run.row.opened_count,
      updatedCount: run.row.updated_count,
      resolvedCount: run.row.resolved_count,
      commitmentShepherd,
      operatorEscalation: existingEscalationSummary,
      reusedRun: true,
    });
  }

  const currentRows = (followupsResult.data || []) as DurableAutomationFollowupRow[];
  const currentByKey = new Map(currentRows.map((row) => [row.source_key, row]));
  const nextByKey = new Map(currentRows.map((row) => [row.source_key, toFollowup(row)]));
  const latestEscalationBySource = latestSuccessfulEscalationBySource(
    (sentEscalationsResult.data || []) as DurableAutomationEscalationRow[],
  );

  const specs = buildSystemsAutomationSpecs({
    reviewDiscipline: dashboard.reviewDiscipline,
    performanceStatus:
      dashboard.slos.find((slo) => slo.id === 'performance')?.status ?? dashboard.overall.status,
    latestPerformanceBaseline: dashboard.latestPerformanceBaseline ?? null,
    trustSurfaceReviewSummary: dashboard.trustSurfaceReviewSummary,
    latestTrustSurfaceReview: dashboard.latestTrustSurfaceReview ?? null,
    incidentSummary: dashboard.incidentSummary,
    incidentHistory: dashboard.incidentHistory,
    openCommitments: dashboard.automationOpenCommitments,
    actions: dashboard.actions,
  });

  const activeKeys = new Set<string>();
  const followupUpserts: Array<Record<string, unknown>> = [];
  const followupAuditRows: Array<Record<string, unknown>> = [];
  let openedCount = 0;
  let updatedCount = 0;
  let resolvedCount = 0;
  const now = new Date().toISOString();

  for (const spec of specs) {
    activeKeys.add(spec.sourceKey);
    const current = currentByKey.get(spec.sourceKey);
    const desiredStatus: SystemsAutomationFollowupStatus =
      current?.status === 'acknowledged' ? 'acknowledged' : 'open';

    if (followupMatchesSpec(current ? toFollowup(current) : undefined, spec, desiredStatus)) {
      if (current) {
        nextByKey.set(spec.sourceKey, toFollowup(current));
      }
      continue;
    }

    const row = buildFollowupUpsertRow({ current, spec, desiredStatus, now });
    followupUpserts.push(row);
    followupAuditRows.push({
      user_id: actor.actor,
      action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
      target: spec.sourceKey,
      payload: {
        sourceKey: spec.sourceKey,
        triggerType: spec.triggerType,
        severity: spec.severity,
        status: desiredStatus,
        title: spec.title,
        summary: spec.summary,
        recommendedAction: spec.recommendedAction,
        actionHref: spec.actionHref ?? null,
        evidence: spec.evidence ?? {},
      },
    });

    if (!current || current.status === 'resolved') openedCount += 1;
    else updatedCount += 1;

    nextByKey.set(spec.sourceKey, {
      sourceKey: spec.sourceKey,
      triggerType: spec.triggerType,
      severity: spec.severity,
      status: desiredStatus,
      title: spec.title,
      summary: spec.summary,
      recommendedAction: spec.recommendedAction,
      actionHref: spec.actionHref ?? null,
      evidence: spec.evidence ?? {},
      updatedAt: now,
    });
  }

  for (const current of currentRows) {
    if (activeKeys.has(current.source_key) || current.status === 'resolved') continue;

    const row = buildResolvedFollowupRow(current, now);
    followupUpserts.push(row);
    followupAuditRows.push({
      user_id: actor.actor,
      action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
      target: current.source_key,
      payload: {
        sourceKey: current.source_key,
        triggerType: current.trigger_type,
        severity: current.severity,
        status: 'resolved',
        title: current.title,
        summary: current.summary,
        recommendedAction: current.recommended_action,
        actionHref: current.action_href ?? null,
        evidence: current.evidence ?? {},
      },
    });

    resolvedCount += 1;
    nextByKey.set(current.source_key, {
      sourceKey: current.source_key,
      triggerType: current.trigger_type,
      severity: current.severity,
      status: 'resolved',
      title: current.title,
      summary: current.summary,
      recommendedAction: current.recommended_action,
      actionHref: current.action_href,
      evidence: current.evidence ?? {},
      updatedAt: now,
    });
  }

  if (followupUpserts.length > 0) {
    const { error: followupError } = await supabase
      .from('systems_automation_followups')
      .upsert(followupUpserts, { onConflict: 'source_key' });

    if (followupError) {
      await supabase
        .from('systems_automation_runs')
        .update({
          status: 'failed',
          summary: 'Failed to persist durable follow-up state.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.row.id);

      return NextResponse.json(
        { error: 'Failed to persist automation follow-ups' },
        { status: 500 },
      );
    }

    const { error: auditError } = await supabase.from('admin_audit_log').insert(followupAuditRows);
    if (auditError) {
      await supabase
        .from('systems_automation_runs')
        .update({
          status: 'failed',
          summary: 'Durable follow-ups updated, but audit mirroring failed.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.row.id);

      return NextResponse.json(
        { error: 'Failed to mirror automation follow-ups to audit log' },
        { status: 500 },
      );
    }
  }

  const nextOpenFollowups = Array.from(nextByKey.values())
    .filter((followup) => followup.status !== 'resolved')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const runSummary = summarizeSystemsAutomationRun(nextOpenFollowups);

  const { error: runUpdateError } = await supabase
    .from('systems_automation_runs')
    .update({
      status: runSummary.status,
      summary: runSummary.summary,
      followup_count: nextOpenFollowups.length,
      critical_count: runSummary.criticalCount,
      opened_count: openedCount,
      updated_count: updatedCount,
      resolved_count: resolvedCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.row.id);

  if (runUpdateError) {
    return NextResponse.json({ error: 'Failed to record automation sweep' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    user_id: actor.actor,
    action: SYSTEMS_AUTOMATION_SWEEP_ACTION,
    target: run.row.id,
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

  const commitmentShepherdTarget = buildSystemsCommitmentShepherdTarget(
    dashboard.automationOpenCommitments,
  );
  const commitmentShepherd = buildSystemsCommitmentShepherdRecord(
    commitmentShepherdTarget,
    actor.actorType,
  );

  await supabase.from('admin_audit_log').insert({
    user_id: actor.actor,
    action: SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
    target: commitmentShepherdTarget?.commitmentId ?? 'systems',
    payload: commitmentShepherd,
  });

  const existingRunEscalations = (runEscalationsResult.data ||
    []) as DurableAutomationEscalationRow[];
  const existingRunEscalationBySource = new Map(
    existingRunEscalations.map((row) => [row.source_key, row]),
  );
  const escalationTargets = buildSystemsOperatorEscalationTargets(
    nextOpenFollowups,
    latestEscalationBySource,
  ).filter((target) => !existingRunEscalationBySource.has(target.sourceKey));

  let operatorEscalation:
    | SystemsOperatorEscalationRecord
    | { status: 'pending'; criticalCount: number }
    | null = summarizeExistingEscalations(existingRunEscalations);

  if (escalationTargets.length > 0) {
    const baseUrl = BASE_URL.startsWith('http://localhost') ? 'https://governada.io' : BASE_URL;
    const digest = formatSystemsOperatorEscalationDigest(escalationTargets, baseUrl);

    const pendingRows = escalationTargets.map((target) => ({
      run_id: run.row.id,
      source_key: target.sourceKey,
      reason: target.reason,
      status: 'pending' as const,
      title: digest.title,
      details: digest.details,
      followup_updated_at: target.updatedAt,
      critical_count: escalationTargets.length,
      channel_count: 0,
      channels: [],
    }));

    const { error: escalationInsertError } = await supabase
      .from('systems_automation_escalations')
      .upsert(pendingRows, { onConflict: 'run_id,source_key' });

    if (escalationInsertError) {
      return NextResponse.json({ error: 'Failed to persist operator escalation' }, { status: 500 });
    }

    const delivery = await sendFounderNotification({
      level: 'escalation',
      title: digest.title,
      details: digest.details,
    });

    const deliveredAt = new Date().toISOString();
    const { error: escalationUpdateError } = await supabase
      .from('systems_automation_escalations')
      .update({
        status: delivery.ok ? 'sent' : 'failed',
        details: delivery.ok
          ? digest.details
          : `${digest.details}\n\nDelivery failure: ${delivery.failureReason ?? 'unknown'}`,
        channel_count: delivery.channelCount,
        channels: delivery.channels,
        delivered_at: delivery.ok ? deliveredAt : null,
      })
      .eq('run_id', run.row.id)
      .in(
        'source_key',
        escalationTargets.map((target) => target.sourceKey),
      );

    if (escalationUpdateError) {
      return NextResponse.json(
        { error: 'Failed to update operator escalation delivery status' },
        { status: 500 },
      );
    }

    await supabase.from('admin_audit_log').insert({
      user_id: actor.actor,
      action: SYSTEMS_OPERATOR_ESCALATION_ACTION,
      target: run.row.id,
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

    operatorEscalation = {
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
      createdAt: deliveredAt,
    };
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
    runKey,
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
