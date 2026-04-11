import { z } from 'zod';
import type {
  SystemsAction,
  SystemsAutomationActivityRecord,
  SystemsAutomationActivityTone,
  SystemsAutomationFollowup,
  SystemsAutomationFollowupStatus,
  SystemsCommitmentShepherdRecord,
  SystemsCommitmentStatus,
  SystemsOperatorEscalationRecord,
  SystemsAutomationRunRecord,
  SystemsAutomationSeverity,
  SystemsAutomationSummary,
  SystemsAutomationTriggerType,
  SystemsCommitmentCard,
  SystemsIncidentRecord,
  SystemsIncidentSummary,
  SystemsPerformanceBaselineRecord,
  SystemsReviewDiscipline,
  SystemsStatus,
  SystemsTrustSurfaceReviewRecord,
  SystemsTrustSurfaceReviewSummary,
} from '@/lib/admin/systems';
import {
  buildSystemsDrillCadenceTarget,
  buildSystemsIncidentRetroTarget,
} from '@/lib/admin/systemsIncidents';
import {
  buildSystemsPerformanceBaselineFollowupTarget,
  SYSTEMS_PERFORMANCE_BASELINE_ACTION,
} from '@/lib/admin/systemsPerformance';
import {
  buildSystemsTrustSurfaceFollowupTarget,
  SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
} from '@/lib/admin/systemsTrustSurface';

export const SYSTEMS_AUTOMATION_FOLLOWUP_ACTION = 'systems_automation_followup_sync';
export const SYSTEMS_AUTOMATION_SWEEP_ACTION = 'systems_automation_sweep';
export const SYSTEMS_OPERATOR_ESCALATION_ACTION = 'systems_operator_escalation';
export const SYSTEMS_COMMITMENT_SHEPHERD_ACTION = 'systems_commitment_shepherd';
export const SYSTEMS_AUTOMATION_AUDIT_ACTIONS = [
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
  SYSTEMS_OPERATOR_ESCALATION_ACTION,
  SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
  SYSTEMS_PERFORMANCE_BASELINE_ACTION,
  SYSTEMS_TRUST_SURFACE_REVIEW_ACTION,
] as const;
export const SYSTEMS_OPERATOR_ESCALATION_REMINDER_HOURS = 24;

type SystemsAutomationAuditRow = {
  action: string;
  target: string | null;
  payload: unknown;
  created_at: string;
};

type SystemsAutomationSpec = {
  sourceKey: string;
  triggerType: SystemsAutomationTriggerType;
  severity: SystemsAutomationSeverity;
  title: string;
  summary: string;
  recommendedAction: string;
  actionHref?: string | null;
  evidence?: Record<string, unknown>;
};

type SystemsAutomationState = {
  allFollowups: SystemsAutomationFollowup[];
  openFollowups: SystemsAutomationFollowup[];
  latestRun: SystemsAutomationRunRecord | null;
};

type SystemsOperatorEscalationAuditRow = {
  action: string;
  payload: unknown;
  created_at: string;
};

type SystemsCommitmentShepherdAuditRow = {
  action: string;
  payload: unknown;
  created_at: string;
};

export type SystemsOperatorEscalationTarget = {
  sourceKey: string;
  title: string;
  summary: string;
  actionHref?: string | null;
  updatedAt: string;
  reason: 'new' | 'reminder';
};

export type SystemsCommitmentShepherdTarget = {
  commitmentId: string;
  commitmentTitle: string;
  commitmentStatus: SystemsCommitmentStatus;
  owner: string;
  dueDate?: string | null;
  reason: 'blocked' | 'overdue';
  actionHref: string;
  summary: string;
  recommendedAction: string;
};

function reasonLabel(reason: SystemsOperatorEscalationTarget['reason']) {
  return reason === 'reminder' ? 'Reminder' : 'New';
}

const followupStatusSchema = z.enum(['open', 'acknowledged', 'resolved']);
const triggerTypeSchema = z.enum([
  'review_discipline',
  'performance_baseline',
  'trust_surface_review',
  'drill_cadence',
  'incident_retro_followup',
  'overdue_commitment',
  'systems_action',
]);
const severitySchema = z.enum(['warning', 'critical']);

const recordSchema = z.record(z.string(), z.unknown());

const followupPayloadSchema = z.object({
  sourceKey: z.string().min(1),
  triggerType: triggerTypeSchema,
  severity: severitySchema,
  status: followupStatusSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  actionHref: z.string().nullable().optional(),
  evidence: recordSchema.optional(),
});

const sweepPayloadSchema = z.object({
  actorType: z.enum(['manual', 'cron']),
  status: z.enum(['good', 'warning', 'critical']),
  summary: z.string().min(1),
  followupCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  openedCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
});

const operatorEscalationPayloadSchema = z.object({
  actorType: z.enum(['manual', 'cron']),
  status: z.enum(['sent', 'failed']),
  title: z.string().min(1),
  details: z.string().min(1),
  criticalCount: z.number().int().positive(),
  followupSourceKeys: z.array(z.string().min(1)).min(1),
  channelCount: z.number().int().nonnegative(),
  channels: z.array(z.string().min(1)),
});

const commitmentShepherdPayloadSchema = z.object({
  actorType: z.enum(['manual', 'cron']),
  status: z.enum(['focus', 'clear']),
  title: z.string().min(1),
  summary: z.string().min(1),
  recommendedAction: z.string().min(1),
  commitmentId: z.string().uuid().nullable().optional(),
  commitmentTitle: z.string().min(1).nullable().optional(),
  commitmentStatus: z.enum(['planned', 'in_progress', 'blocked', 'done']).nullable().optional(),
  owner: z.string().min(1).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  reason: z.enum(['blocked', 'overdue']).nullable().optional(),
  actionHref: z.string().min(1).nullable().optional(),
});

export const updateSystemsAutomationFollowupSchema = z.object({
  sourceKey: z.string().trim().min(1).max(200),
  status: followupStatusSchema,
});

function followupSortValue(status: SystemsAutomationFollowupStatus): number {
  switch (status) {
    case 'open':
      return 0;
    case 'acknowledged':
      return 1;
    default:
      return 2;
  }
}

function severitySortValue(severity: SystemsAutomationSeverity): number {
  return severity === 'critical' ? 0 : 1;
}

function buildFollowup(
  payload: z.infer<typeof followupPayloadSchema>,
  createdAt: string,
): SystemsAutomationFollowup {
  return {
    sourceKey: payload.sourceKey,
    triggerType: payload.triggerType,
    severity: payload.severity,
    status: payload.status,
    title: payload.title,
    summary: payload.summary,
    recommendedAction: payload.recommendedAction,
    actionHref: payload.actionHref ?? null,
    evidence: payload.evidence,
    updatedAt: createdAt,
  };
}

function triggerTypeLabel(triggerType: SystemsAutomationTriggerType) {
  switch (triggerType) {
    case 'review_discipline':
      return 'Review discipline';
    case 'performance_baseline':
      return 'Performance baseline';
    case 'trust_surface_review':
      return 'Trust surfaces';
    case 'drill_cadence':
      return 'Drill cadence';
    case 'incident_retro_followup':
      return 'Incident retro';
    case 'overdue_commitment':
      return 'Commitment health';
    default:
      return 'Systems action';
  }
}

function followupStatusLabel(status: SystemsAutomationFollowupStatus) {
  switch (status) {
    case 'acknowledged':
      return 'Acknowledged';
    case 'resolved':
      return 'Resolved';
    default:
      return 'Open follow-up';
  }
}

function followupActivityTone(
  severity: SystemsAutomationSeverity,
  status: SystemsAutomationFollowupStatus,
): SystemsAutomationActivityTone {
  if (status === 'resolved') return 'good';
  if (status === 'acknowledged') return 'neutral';
  return severity === 'critical' ? 'critical' : 'warning';
}

function sweepStatusLabel(status: SystemsAutomationRunRecord['status']) {
  switch (status) {
    case 'good':
      return 'Healthy sweep';
    case 'warning':
      return 'Watch sweep';
    default:
      return 'Critical sweep';
  }
}

function buildAutomationActivityId(
  type: SystemsAutomationActivityRecord['type'],
  createdAt: string,
  target?: string | null,
) {
  return [type, createdAt, target ?? 'systems'].join(':');
}

function buildSweepActivity(
  row: SystemsAutomationAuditRow,
  payload: z.infer<typeof sweepPayloadSchema>,
): SystemsAutomationActivityRecord {
  return {
    id: buildAutomationActivityId('sweep', row.created_at, row.target),
    type: 'sweep',
    actorType: payload.actorType,
    statusLabel: sweepStatusLabel(payload.status),
    tone: payload.status,
    title: payload.actorType === 'cron' ? 'Scheduled daily sweep' : 'Manual automation sweep',
    summary: payload.summary,
    createdAt: row.created_at,
    actionHref: '/admin/systems/history',
    metricItems: [
      { label: 'Open follow-ups', value: String(payload.followupCount) },
      { label: 'Critical', value: String(payload.criticalCount) },
      { label: 'Opened', value: String(payload.openedCount) },
      { label: 'Resolved', value: String(payload.resolvedCount) },
    ],
  };
}

function buildFollowupActivity(
  row: SystemsAutomationAuditRow,
  payload: z.infer<typeof followupPayloadSchema>,
): SystemsAutomationActivityRecord {
  return {
    id: buildAutomationActivityId('followup', row.created_at, payload.sourceKey),
    type: 'followup',
    actorType: 'system',
    statusLabel: followupStatusLabel(payload.status),
    tone: followupActivityTone(payload.severity, payload.status),
    title: payload.title,
    summary: payload.summary,
    createdAt: row.created_at,
    actionHref: payload.actionHref ?? null,
    sourceKey: payload.sourceKey,
    metricItems: [
      { label: 'Trigger', value: triggerTypeLabel(payload.triggerType) },
      { label: 'Severity', value: payload.severity === 'critical' ? 'Critical' : 'Warning' },
      { label: 'State', value: followupStatusLabel(payload.status) },
    ],
  };
}

function buildOperatorEscalationActivity(
  row: SystemsAutomationAuditRow,
  payload: z.infer<typeof operatorEscalationPayloadSchema>,
): SystemsAutomationActivityRecord {
  return {
    id: buildAutomationActivityId('operator_escalation', row.created_at, row.target),
    type: 'operator_escalation',
    actorType: payload.actorType,
    statusLabel: payload.status === 'sent' ? 'Digest sent' : 'Delivery failed',
    tone: payload.status === 'sent' ? 'warning' : 'critical',
    title: payload.title,
    summary: payload.details,
    createdAt: row.created_at,
    actionHref: '/admin/systems/history',
    metricItems: [
      { label: 'Critical follow-ups', value: String(payload.criticalCount) },
      { label: 'Channels', value: String(payload.channelCount) },
    ],
  };
}

function buildCommitmentShepherdActivity(
  row: SystemsAutomationAuditRow,
  payload: z.infer<typeof commitmentShepherdPayloadSchema>,
): SystemsAutomationActivityRecord {
  return {
    id: buildAutomationActivityId(
      'commitment_shepherd',
      row.created_at,
      payload.commitmentId ?? row.target,
    ),
    type: 'commitment_shepherd',
    actorType: payload.actorType,
    statusLabel: payload.status === 'focus' ? 'Needs focus' : 'Clear',
    tone:
      payload.status === 'clear' ? 'good' : payload.reason === 'blocked' ? 'critical' : 'warning',
    title: payload.title,
    summary: payload.summary,
    createdAt: row.created_at,
    actionHref: payload.actionHref ?? '/admin/systems/queue',
    metricItems: [
      { label: 'Commitment', value: payload.commitmentTitle ?? 'No stale commitment' },
      ...(payload.owner ? [{ label: 'Owner', value: payload.owner }] : []),
    ],
  };
}

function sameEvidence(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

export function buildSystemsAutomationState(
  rows: SystemsAutomationAuditRow[],
): SystemsAutomationState {
  const latestByKey = new Map<string, SystemsAutomationFollowup>();
  let latestRun: SystemsAutomationRunRecord | null = null;

  for (const row of rows) {
    if (row.action === SYSTEMS_AUTOMATION_FOLLOWUP_ACTION) {
      const parsed = followupPayloadSchema.safeParse(row.payload);
      if (!parsed.success || latestByKey.has(parsed.data.sourceKey)) continue;
      latestByKey.set(parsed.data.sourceKey, buildFollowup(parsed.data, row.created_at));
      continue;
    }

    if (row.action === SYSTEMS_AUTOMATION_SWEEP_ACTION && latestRun === null) {
      const parsed = sweepPayloadSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      latestRun = {
        actorType: parsed.data.actorType,
        status: parsed.data.status,
        summary: parsed.data.summary,
        followupCount: parsed.data.followupCount,
        criticalCount: parsed.data.criticalCount,
        openedCount: parsed.data.openedCount,
        updatedCount: parsed.data.updatedCount,
        resolvedCount: parsed.data.resolvedCount,
        createdAt: row.created_at,
      };
    }
  }

  const allFollowups = Array.from(latestByKey.values()).sort((left, right) => {
    if (severitySortValue(left.severity) !== severitySortValue(right.severity)) {
      return severitySortValue(left.severity) - severitySortValue(right.severity);
    }
    if (followupSortValue(left.status) !== followupSortValue(right.status)) {
      return followupSortValue(left.status) - followupSortValue(right.status);
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });

  return {
    allFollowups,
    openFollowups: allFollowups.filter((followup) => followup.status !== 'resolved'),
    latestRun,
  };
}

export function buildSystemsAutomationSummary(
  followups: SystemsAutomationFollowup[],
  latestRun: SystemsAutomationRunRecord | null,
): SystemsAutomationSummary {
  const criticalCount = followups.filter((followup) => followup.severity === 'critical').length;

  if (!latestRun) {
    return {
      status: followups.length > 0 ? (criticalCount > 0 ? 'critical' : 'warning') : 'bootstrap',
      headline:
        followups.length > 0
          ? 'Automation inbox has live follow-ups but no sweep history yet'
          : 'Automation sweep has not run yet',
      currentValue:
        followups.length > 0
          ? `${followups.length} open follow-up${followups.length === 1 ? '' : 's'}`
          : 'No sweep recorded',
      target: 'A fresh sweep each day and zero unresolved critical follow-ups',
      summary:
        followups.length > 0
          ? 'The inbox already has unresolved systems follow-ups. Run the sweep so the operating loop has a durable heartbeat and a fresh summary.'
          : 'Run the first systems sweep so this cockpit can start leaving behind durable operating follow-ups instead of one-off observations.',
      lastSweepAt: null,
    };
  }

  if (criticalCount > 0) {
    return {
      status: 'critical',
      headline: 'Automation inbox has critical operating work open',
      currentValue: `${followups.length} open / ${criticalCount} critical`,
      target: 'A fresh sweep each day and zero unresolved critical follow-ups',
      summary:
        'At least one critical systems follow-up is still open. Treat the inbox as an operating queue, not a passive reminder list.',
      lastSweepAt: latestRun.createdAt,
    };
  }

  if (followups.length > 0 || latestRun.status === 'warning') {
    return {
      status: 'warning',
      headline: 'Automation is active, but it still needs founder follow-through',
      currentValue: `${followups.length} open follow-up${followups.length === 1 ? '' : 's'}`,
      target: 'A fresh sweep each day and zero unresolved critical follow-ups',
      summary:
        'The sweep is running and producing useful work, but there are still unresolved warning-level follow-ups to clear or acknowledge.',
      lastSweepAt: latestRun.createdAt,
    };
  }

  return {
    status: 'good',
    headline: 'Automation loop looks healthy right now',
    currentValue: 'No open automation follow-ups',
    target: 'A fresh sweep each day and zero unresolved critical follow-ups',
    summary:
      'The most recent sweep found no unresolved systems issues that required durable follow-up. Keep the sweep cadence alive so this stays trustworthy.',
    lastSweepAt: latestRun.createdAt,
  };
}

export function buildLatestSuccessfulEscalationBySource(
  rows: SystemsOperatorEscalationAuditRow[],
): Map<string, string> {
  const latestBySource = new Map<string, string>();

  for (const row of rows) {
    if (row.action !== SYSTEMS_OPERATOR_ESCALATION_ACTION) continue;

    const parsed = operatorEscalationPayloadSchema.safeParse(row.payload);
    if (!parsed.success || parsed.data.status !== 'sent') continue;

    for (const sourceKey of parsed.data.followupSourceKeys) {
      if (!latestBySource.has(sourceKey)) {
        latestBySource.set(sourceKey, row.created_at);
      }
    }
  }

  return latestBySource;
}

export function parseLatestSystemsOperatorEscalation(
  rows: SystemsOperatorEscalationAuditRow[],
): SystemsOperatorEscalationRecord | null {
  for (const row of rows) {
    if (row.action !== SYSTEMS_OPERATOR_ESCALATION_ACTION) continue;

    const parsed = operatorEscalationPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    return {
      actorType: parsed.data.actorType,
      status: parsed.data.status,
      title: parsed.data.title,
      details: parsed.data.details,
      criticalCount: parsed.data.criticalCount,
      followupSourceKeys: parsed.data.followupSourceKeys,
      channelCount: parsed.data.channelCount,
      channels: parsed.data.channels,
      createdAt: row.created_at,
    };
  }

  return null;
}

function commitmentShepherdReasonRank(reason: SystemsCommitmentShepherdTarget['reason']) {
  return reason === 'blocked' ? 0 : 1;
}

function overdueDays(commitment: SystemsCommitmentCard) {
  if (!commitment.dueDate || !commitment.isOverdue) return 0;
  const dueDate = new Date(`${commitment.dueDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((Date.now() - dueDate) / (1000 * 60 * 60 * 24)));
}

export function buildSystemsCommitmentShepherdTarget(
  openCommitments: SystemsCommitmentCard[],
): SystemsCommitmentShepherdTarget | null {
  const candidates = openCommitments
    .filter((commitment) => commitment.status === 'blocked' || commitment.isOverdue)
    .map((commitment) => {
      const reason: SystemsCommitmentShepherdTarget['reason'] =
        commitment.status === 'blocked' ? 'blocked' : 'overdue';
      return {
        commitmentId: commitment.id,
        commitmentTitle: commitment.title,
        commitmentStatus: commitment.status,
        owner: commitment.owner,
        dueDate: commitment.dueDate ?? null,
        reason,
        actionHref: '/admin/systems/queue',
        summary:
          reason === 'blocked'
            ? `${commitment.title} is blocked under ${commitment.owner}. Leaving it stale will keep the same launch risk alive until the blocker is named and either cleared or replaced.`
            : `${commitment.title} is overdue under ${commitment.owner}. The weekly loop loses credibility when overdue hardening work sits open without an honest status change.`,
        recommendedAction:
          reason === 'blocked'
            ? 'Open the commitment card, confirm the blocker, and decide today whether to unblock this work this week or replace it in the next review.'
            : 'Open the commitment card and either move it forward, mark it blocked with the real blocker, or close it honestly if it no longer deserves to stay open.',
        sortPriority: commitmentShepherdReasonRank(reason),
        overdueDays: overdueDays(commitment),
        ageDays: commitment.ageDays,
      };
    })
    .sort((left, right) => {
      if (left.sortPriority !== right.sortPriority) {
        return left.sortPriority - right.sortPriority;
      }
      if (left.overdueDays !== right.overdueDays) {
        return right.overdueDays - left.overdueDays;
      }
      if ((left.dueDate ?? '') !== (right.dueDate ?? '')) {
        return (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31');
      }
      return right.ageDays - left.ageDays;
    });

  const target = candidates[0];
  if (!target) return null;

  return {
    commitmentId: target.commitmentId,
    commitmentTitle: target.commitmentTitle,
    commitmentStatus: target.commitmentStatus,
    owner: target.owner,
    dueDate: target.dueDate,
    reason: target.reason,
    actionHref: target.actionHref,
    summary: target.summary,
    recommendedAction: target.recommendedAction,
  };
}

export function buildSystemsCommitmentShepherdRecord(
  target: SystemsCommitmentShepherdTarget | null,
  actorType: 'manual' | 'cron',
) {
  if (!target) {
    return {
      actorType,
      status: 'clear' as const,
      title: 'Commitment shepherd: no stale commitment needs focus',
      summary: 'No blocked or overdue hardening commitment currently needs a rescue loop.',
      recommendedAction:
        'Keep the weekly review leaving behind one honest commitment and rerun the sweep tomorrow.',
      commitmentId: null,
      commitmentTitle: null,
      commitmentStatus: null,
      owner: null,
      dueDate: null,
      reason: null,
      actionHref: null,
    };
  }

  return {
    actorType,
    status: 'focus' as const,
    title: `Commitment shepherd: ${target.commitmentTitle}`,
    summary: target.summary,
    recommendedAction: target.recommendedAction,
    commitmentId: target.commitmentId,
    commitmentTitle: target.commitmentTitle,
    commitmentStatus: target.commitmentStatus,
    owner: target.owner,
    dueDate: target.dueDate ?? null,
    reason: target.reason,
    actionHref: target.actionHref,
  };
}

export function parseLatestSystemsCommitmentShepherd(
  rows: SystemsCommitmentShepherdAuditRow[],
): SystemsCommitmentShepherdRecord | null {
  for (const row of rows) {
    if (row.action !== SYSTEMS_COMMITMENT_SHEPHERD_ACTION) continue;

    const parsed = commitmentShepherdPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    return {
      actorType: parsed.data.actorType,
      status: parsed.data.status,
      title: parsed.data.title,
      summary: parsed.data.summary,
      recommendedAction: parsed.data.recommendedAction,
      commitmentId: parsed.data.commitmentId ?? null,
      commitmentTitle: parsed.data.commitmentTitle ?? null,
      commitmentStatus: parsed.data.commitmentStatus ?? null,
      owner: parsed.data.owner ?? null,
      dueDate: parsed.data.dueDate ?? null,
      reason: parsed.data.reason ?? null,
      actionHref: parsed.data.actionHref ?? null,
      createdAt: row.created_at,
    };
  }

  return null;
}

export function buildSystemsAutomationHistory(
  rows: SystemsAutomationAuditRow[],
): SystemsAutomationActivityRecord[] {
  const history: SystemsAutomationActivityRecord[] = [];

  for (const row of rows) {
    if (row.action === SYSTEMS_AUTOMATION_FOLLOWUP_ACTION) {
      const parsed = followupPayloadSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      history.push(buildFollowupActivity(row, parsed.data));
      continue;
    }

    if (row.action === SYSTEMS_AUTOMATION_SWEEP_ACTION) {
      const parsed = sweepPayloadSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      history.push(buildSweepActivity(row, parsed.data));
      continue;
    }

    if (row.action === SYSTEMS_OPERATOR_ESCALATION_ACTION) {
      const parsed = operatorEscalationPayloadSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      history.push(buildOperatorEscalationActivity(row, parsed.data));
      continue;
    }

    if (row.action === SYSTEMS_COMMITMENT_SHEPHERD_ACTION) {
      const parsed = commitmentShepherdPayloadSchema.safeParse(row.payload);
      if (!parsed.success) continue;
      history.push(buildCommitmentShepherdActivity(row, parsed.data));
    }
  }

  return history;
}

export function buildSystemsOperatorEscalationTargets(
  followups: SystemsAutomationFollowup[],
  latestEscalationBySource: Map<string, string>,
  now = new Date(),
): SystemsOperatorEscalationTarget[] {
  const targets: SystemsOperatorEscalationTarget[] = [];

  for (const followup of followups) {
    if (followup.severity !== 'critical' || followup.status !== 'open') continue;

    const baseTarget = {
      sourceKey: followup.sourceKey,
      title: followup.title,
      summary: followup.summary,
      actionHref: followup.actionHref ?? null,
      updatedAt: followup.updatedAt,
    };
    const lastEscalatedAt = latestEscalationBySource.get(followup.sourceKey);

    if (!lastEscalatedAt || followup.updatedAt > lastEscalatedAt) {
      targets.push({
        ...baseTarget,
        reason: 'new',
      });
      continue;
    }

    const reminderAfter =
      new Date(lastEscalatedAt).getTime() +
      SYSTEMS_OPERATOR_ESCALATION_REMINDER_HOURS * 60 * 60 * 1000;

    if (now.getTime() >= reminderAfter) {
      targets.push({
        ...baseTarget,
        reason: 'reminder',
      });
    }
  }

  return targets;
}

export function formatSystemsOperatorEscalationDigest(
  targets: SystemsOperatorEscalationTarget[],
  baseUrl: string,
): { title: string; details: string } {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const title =
    targets.length === 1
      ? 'Systems cockpit: 1 critical follow-up still open'
      : `Systems cockpit: ${targets.length} critical follow-ups still open`;

  const lines = [
    'Critical systems follow-ups are still open after the latest sweep.',
    '',
    ...targets.slice(0, 3).flatMap((target, index) => {
      const nextStep = target.actionHref
        ? `${normalizedBaseUrl}${target.actionHref}`
        : `${normalizedBaseUrl}/admin/systems/queue`;
      return [
        `${index + 1}. [${reasonLabel(target.reason)}] ${target.title}`,
        `   Why: ${target.summary}`,
        `   Next: ${nextStep}`,
      ];
    }),
  ];

  if (targets.length > 3) {
    lines.push('', `+${targets.length - 3} more critical follow-up(s) in /admin/systems/queue`);
  }

  return {
    title,
    details: lines.join('\n'),
  };
}

export function buildSystemsAutomationSpecs(input: {
  reviewDiscipline: SystemsReviewDiscipline;
  performanceStatus: SystemsStatus;
  latestPerformanceBaseline: SystemsPerformanceBaselineRecord | null;
  trustSurfaceReviewSummary: SystemsTrustSurfaceReviewSummary;
  latestTrustSurfaceReview: SystemsTrustSurfaceReviewRecord | null;
  incidentSummary: SystemsIncidentSummary;
  incidentHistory: SystemsIncidentRecord[];
  openCommitments: SystemsCommitmentCard[];
  actions: SystemsAction[];
}): SystemsAutomationSpec[] {
  const specs: SystemsAutomationSpec[] = [];

  if (input.reviewDiscipline.status !== 'good') {
    specs.push({
      sourceKey: 'systems:review-discipline',
      triggerType: 'review_discipline',
      severity: input.reviewDiscipline.status === 'critical' ? 'critical' : 'warning',
      title:
        input.reviewDiscipline.status === 'critical'
          ? 'Refresh the weekly systems review now'
          : 'Refresh the weekly systems review soon',
      summary: input.reviewDiscipline.summary,
      recommendedAction:
        'Open the weekly operating loop, log a fresh review, and leave behind one named hardening commitment for the week.',
      actionHref: '/admin/systems/queue?panel=review',
      evidence: {
        lastReviewedAt: input.reviewDiscipline.lastReviewedAt ?? null,
        overdueCommitments: input.reviewDiscipline.overdueCommitments,
        openCommitments: input.reviewDiscipline.openCommitments,
      },
    });
  }

  const performanceBaselineTarget = buildSystemsPerformanceBaselineFollowupTarget({
    latestBaseline: input.latestPerformanceBaseline,
    performanceStatus: input.performanceStatus,
  });

  if (performanceBaselineTarget) {
    specs.push({
      sourceKey: performanceBaselineTarget.sourceKey,
      triggerType: 'performance_baseline',
      severity: performanceBaselineTarget.severity,
      title: performanceBaselineTarget.title,
      summary: performanceBaselineTarget.summary,
      recommendedAction: performanceBaselineTarget.recommendedAction,
      actionHref: performanceBaselineTarget.actionHref,
      evidence: performanceBaselineTarget.evidence,
    });
  }

  const trustSurfaceTarget = buildSystemsTrustSurfaceFollowupTarget({
    latestReview: input.latestTrustSurfaceReview,
    summary: input.trustSurfaceReviewSummary,
  });

  if (trustSurfaceTarget) {
    specs.push({
      sourceKey: trustSurfaceTarget.sourceKey,
      triggerType: 'trust_surface_review',
      severity: trustSurfaceTarget.severity,
      title: trustSurfaceTarget.title,
      summary: trustSurfaceTarget.summary,
      recommendedAction: trustSurfaceTarget.recommendedAction,
      actionHref: trustSurfaceTarget.actionHref,
      evidence: trustSurfaceTarget.evidence,
    });
  }

  const drillCadenceTarget = buildSystemsDrillCadenceTarget({
    summary: input.incidentSummary,
    history: input.incidentHistory,
  });

  if (drillCadenceTarget) {
    specs.push({
      sourceKey: drillCadenceTarget.sourceKey,
      triggerType: 'drill_cadence',
      severity: drillCadenceTarget.severity,
      title: drillCadenceTarget.title,
      summary: drillCadenceTarget.summary,
      recommendedAction: drillCadenceTarget.recommendedAction,
      actionHref: drillCadenceTarget.actionHref,
      evidence: {
        reason: drillCadenceTarget.reason,
        drillCount: drillCadenceTarget.drillCount,
        lastDrillAt: drillCadenceTarget.lastDrillAt,
        suggestedScenario: drillCadenceTarget.suggestedScenario,
        suggestedTitle: drillCadenceTarget.suggestedTitle,
        suggestedSystems: drillCadenceTarget.suggestedSystems,
      },
    });
  }

  const incidentRetroTarget = buildSystemsIncidentRetroTarget({
    history: input.incidentHistory,
    openCommitments: input.openCommitments,
  });

  if (incidentRetroTarget) {
    specs.push({
      sourceKey: incidentRetroTarget.sourceKey,
      triggerType: 'incident_retro_followup',
      severity: incidentRetroTarget.severity,
      title: incidentRetroTarget.title,
      summary: incidentRetroTarget.summary,
      recommendedAction: incidentRetroTarget.recommendedAction,
      actionHref: incidentRetroTarget.actionHref,
      evidence: {
        entryId: incidentRetroTarget.entryId,
        entryType: incidentRetroTarget.entryType,
        incidentDate: incidentRetroTarget.incidentDate,
        incidentTitle: incidentRetroTarget.incidentTitle,
        followUpOwner: incidentRetroTarget.followUpOwner,
        commitmentTitle: incidentRetroTarget.commitmentTitle,
        commitmentSummary: incidentRetroTarget.commitmentSummary,
        linkedSloIds: incidentRetroTarget.linkedSloIds,
      },
    });
  }

  for (const commitment of input.openCommitments.filter((item) => item.isOverdue)) {
    specs.push({
      sourceKey: `systems:commitment:${commitment.id}`,
      triggerType: 'overdue_commitment',
      severity: commitment.status === 'blocked' ? 'critical' : 'warning',
      title: `Unstick overdue commitment: ${commitment.title}`,
      summary: `${commitment.summary} Owner: ${commitment.owner}. ${
        commitment.dueDate ? `Due ${commitment.dueDate}.` : 'No due date recorded.'
      }`,
      recommendedAction:
        'Either move the commitment forward, re-scope it honestly, or mark it blocked with a clear explanation so the loop stays trustworthy.',
      actionHref: '/admin/systems/queue',
      evidence: {
        commitmentId: commitment.id,
        owner: commitment.owner,
        dueDate: commitment.dueDate ?? null,
        linkedSloIds: commitment.linkedSloIds,
      },
    });
  }

  for (const action of input.actions) {
    const shouldAutomate = action.automationReady && action.priority === 'P0';
    if (!shouldAutomate) continue;

    specs.push({
      sourceKey: `systems:action:${action.id}`,
      triggerType: 'systems_action',
      severity: action.priority === 'P0' ? 'critical' : 'warning',
      title: action.title,
      summary: action.summary,
      recommendedAction:
        action.id === 'record-baseline'
          ? 'Run the baseline, attach the result to the operating loop, and decide whether the launch bar needs to tighten.'
          : 'Treat this as a live operating issue and resolve it before normal feature velocity resumes.',
      actionHref: action.href ?? null,
      evidence: {
        priority: action.priority,
        timeframe: action.timeframe,
      },
    });
  }

  return specs;
}

export function followupMatchesSpec(
  current: SystemsAutomationFollowup | undefined,
  spec: SystemsAutomationSpec,
  desiredStatus: SystemsAutomationFollowupStatus,
) {
  if (!current) return false;
  return (
    current.triggerType === spec.triggerType &&
    current.severity === spec.severity &&
    current.status === desiredStatus &&
    current.title === spec.title &&
    current.summary === spec.summary &&
    current.recommendedAction === spec.recommendedAction &&
    (current.actionHref ?? null) === (spec.actionHref ?? null) &&
    sameEvidence(current.evidence, spec.evidence)
  );
}

export function summarizeSystemsAutomationRun(followups: SystemsAutomationFollowup[]): {
  status: Exclude<SystemsStatus, 'bootstrap'>;
  summary: string;
  criticalCount: number;
} {
  const criticalCount = followups.filter((followup) => followup.severity === 'critical').length;

  if (criticalCount > 0) {
    return {
      status: 'critical',
      summary: `Sweep surfaced ${followups.length} open follow-up${followups.length === 1 ? '' : 's'}, including ${criticalCount} critical issue${criticalCount === 1 ? '' : 's'}.`,
      criticalCount,
    };
  }

  if (followups.length > 0) {
    return {
      status: 'warning',
      summary: `Sweep surfaced ${followups.length} warning-level follow-up${followups.length === 1 ? '' : 's'} for the founder operating loop.`,
      criticalCount,
    };
  }

  return {
    status: 'good',
    summary: 'Sweep found no unresolved systems follow-ups.',
    criticalCount: 0,
  };
}
