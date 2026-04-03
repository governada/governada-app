import { z } from 'zod';
import type {
  SystemsAction,
  SystemsAutomationFollowup,
  SystemsAutomationFollowupStatus,
  SystemsAutomationRunRecord,
  SystemsAutomationSeverity,
  SystemsAutomationSummary,
  SystemsAutomationTriggerType,
  SystemsCommitmentCard,
  SystemsReviewDiscipline,
  SystemsStatus,
} from '@/lib/admin/systems';

export const SYSTEMS_AUTOMATION_FOLLOWUP_ACTION = 'systems_automation_followup_sync';
export const SYSTEMS_AUTOMATION_SWEEP_ACTION = 'systems_automation_sweep';
export const SYSTEMS_AUTOMATION_AUDIT_ACTIONS = [
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
] as const;

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

const followupStatusSchema = z.enum(['open', 'acknowledged', 'resolved']);
const triggerTypeSchema = z.enum(['review_discipline', 'overdue_commitment', 'systems_action']);
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

export function buildSystemsAutomationSpecs(input: {
  reviewDiscipline: SystemsReviewDiscipline;
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
      actionHref: '/admin/systems#weekly-review',
      evidence: {
        lastReviewedAt: input.reviewDiscipline.lastReviewedAt ?? null,
        overdueCommitments: input.reviewDiscipline.overdueCommitments,
        openCommitments: input.reviewDiscipline.openCommitments,
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
      actionHref: '/admin/systems#weekly-review',
      evidence: {
        commitmentId: commitment.id,
        owner: commitment.owner,
        dueDate: commitment.dueDate ?? null,
        linkedSloIds: commitment.linkedSloIds,
      },
    });
  }

  for (const action of input.actions) {
    const shouldAutomate =
      action.automationReady && (action.priority === 'P0' || action.id === 'record-baseline');
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
