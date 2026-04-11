import { z } from 'zod';
import type {
  SystemsAutomationActivityRecord,
  SystemsDashboardData,
  SystemsReviewDraft,
  SystemsStatus,
} from '@/lib/admin/systems';

export const SYSTEMS_REVIEW_DRAFT_ACTION = 'systems_review_draft_generated';

type SystemsReviewDraftAuditRow = {
  action: string;
  payload: unknown;
  created_at: string;
};

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const systemsStatusSchema = z.enum(['good', 'warning', 'critical', 'bootstrap']);

const reviewDraftPayloadSchema = z.object({
  actorType: z.enum(['manual', 'cron']),
  generatedAt: z.string().min(1),
  reviewDate: dateString,
  overallStatus: systemsStatusSchema,
  focusArea: z.string().min(1),
  topRisk: z.string().min(1),
  changeNotes: z.string().min(1),
  hardeningCommitmentTitle: z.string().min(1),
  hardeningCommitmentSummary: z.string().min(1),
  commitmentOwner: z.string().min(1),
  commitmentDueDate: dateString.nullable().optional(),
  linkedSloIds: z.array(z.string().min(1)).max(5),
  linkedIncidentId: z.string().uuid().nullable().optional(),
});

function clampText(input: string | null | undefined, max: number, fallback: string) {
  const cleaned = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3).trimEnd()}...`;
}

function summarizeOverallStatus(status: SystemsStatus) {
  switch (status) {
    case 'good':
      return 'healthy';
    case 'warning':
      return 'watch-level';
    case 'critical':
      return 'act-now';
    default:
      return 'bootstrapping';
  }
}

function todayInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nextFridayInputValue(date: Date) {
  const next = new Date(date);
  const day = next.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  next.setUTCDate(next.getUTCDate() + daysUntilFriday);
  return todayInputValue(next);
}

function buildLinkedSloIds(data: SystemsDashboardData, preferredIds?: string[]) {
  if (preferredIds && preferredIds.length > 0) return preferredIds.slice(0, 3);
  const nonGood = data.slos.filter((slo) => slo.status !== 'good').map((slo) => slo.id);
  if (nonGood.length > 0) return nonGood.slice(0, 3);
  return data.slos.slice(0, 1).map((slo) => slo.id);
}

function extractIncidentRetroEvidence(
  followup: SystemsDashboardData['automationFollowups'][number] | null,
) {
  if (!followup || followup.triggerType !== 'incident_retro_followup' || !followup.evidence) {
    return null;
  }

  const linkedSloIds = Array.isArray(followup.evidence.linkedSloIds)
    ? followup.evidence.linkedSloIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  if (
    typeof followup.evidence.commitmentTitle !== 'string' ||
    typeof followup.evidence.commitmentSummary !== 'string' ||
    typeof followup.evidence.followUpOwner !== 'string'
  ) {
    return null;
  }

  return {
    commitmentTitle: followup.evidence.commitmentTitle,
    commitmentSummary: followup.evidence.commitmentSummary,
    followUpOwner: followup.evidence.followUpOwner,
    incidentTitle:
      typeof followup.evidence.incidentTitle === 'string' ? followup.evidence.incidentTitle : null,
    incidentId: typeof followup.evidence.entryId === 'string' ? followup.evidence.entryId : null,
    linkedSloIds,
  };
}

function extractPerformanceBaselineEvidence(
  followup: SystemsDashboardData['automationFollowups'][number] | null,
) {
  if (!followup || followup.triggerType !== 'performance_baseline' || !followup.evidence) {
    return null;
  }

  return {
    latestBaselineDate:
      typeof followup.evidence.latestBaselineDate === 'string'
        ? followup.evidence.latestBaselineDate
        : null,
    bottleneck:
      typeof followup.evidence.bottleneck === 'string' ? followup.evidence.bottleneck : null,
    mitigationOwner:
      typeof followup.evidence.mitigationOwner === 'string'
        ? followup.evidence.mitigationOwner
        : null,
    reason: typeof followup.evidence.reason === 'string' ? followup.evidence.reason : null,
  };
}

function extractTrustSurfaceEvidence(
  followup: SystemsDashboardData['automationFollowups'][number] | null,
) {
  if (!followup || followup.triggerType !== 'trust_surface_review' || !followup.evidence) {
    return null;
  }

  const linkedSloIds = Array.isArray(followup.evidence.linkedSloIds)
    ? followup.evidence.linkedSloIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  const reviewedSurfaces = Array.isArray(followup.evidence.reviewedSurfaces)
    ? followup.evidence.reviewedSurfaces.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  return {
    reviewDate:
      typeof followup.evidence.reviewDate === 'string' ? followup.evidence.reviewDate : null,
    owner: typeof followup.evidence.owner === 'string' ? followup.evidence.owner : null,
    honestyGap:
      typeof followup.evidence.honestyGap === 'string' ? followup.evidence.honestyGap : null,
    reason: typeof followup.evidence.reason === 'string' ? followup.evidence.reason : null,
    linkedSloIds,
    reviewedSurfaces,
  };
}

export function buildSystemsReviewDraft(
  data: SystemsDashboardData,
  actorType: 'manual' | 'cron',
): SystemsReviewDraft {
  const generatedAt = new Date().toISOString();
  const reviewDate = todayInputValue(new Date(generatedAt));
  const primaryAction = data.actions[0] ?? null;
  const incidentRetroFollowup =
    data.automationFollowups.find(
      (followup) => followup.triggerType === 'incident_retro_followup',
    ) ?? null;
  const incidentRetroEvidence = extractIncidentRetroEvidence(incidentRetroFollowup);
  const performanceBaselineFollowup =
    data.automationFollowups.find((followup) => followup.triggerType === 'performance_baseline') ??
    null;
  const performanceBaselineEvidence = extractPerformanceBaselineEvidence(
    performanceBaselineFollowup,
  );
  const trustSurfaceFollowup =
    data.automationFollowups.find((followup) => followup.triggerType === 'trust_surface_review') ??
    null;
  const trustSurfaceEvidence = extractTrustSurfaceEvidence(trustSurfaceFollowup);
  const linkedSloIds = buildLinkedSloIds(
    data,
    incidentRetroEvidence?.linkedSloIds ?? trustSurfaceEvidence?.linkedSloIds,
  );
  const primaryFollowup = data.automationFollowups[0] ?? null;
  const commitmentShepherd =
    data.latestCommitmentShepherd?.status === 'focus' ? data.latestCommitmentShepherd : null;
  const scorecardSync = data.scorecardSync.status !== 'good' ? data.scorecardSync : null;
  const incidentSummary = data.incidentSummary.status !== 'good' ? data.incidentSummary : null;
  const primaryBlocker = data.story.blockers[0] ?? null;
  const primaryWatchout = data.story.watchouts[0] ?? null;
  const primaryWin = data.story.wins[0] ?? null;

  const focusArea = clampText(
    commitmentShepherd?.title ??
      incidentRetroFollowup?.title ??
      trustSurfaceFollowup?.title ??
      performanceBaselineFollowup?.title ??
      primaryFollowup?.title ??
      primaryAction?.title ??
      scorecardSync?.headline ??
      data.reviewLoop.currentFocus,
    120,
    'Launch systems hardening',
  );

  const topRisk = clampText(
    primaryBlocker ??
      commitmentShepherd?.summary ??
      trustSurfaceFollowup?.summary ??
      performanceBaselineFollowup?.summary ??
      primaryFollowup?.summary ??
      scorecardSync?.summary ??
      primaryWatchout ??
      data.overall.narrative,
    500,
    'The operating posture needs a fresh founder review.',
  );

  const hardeningCommitmentTitle = clampText(
    commitmentShepherd?.commitmentTitle ??
      incidentRetroEvidence?.commitmentTitle ??
      trustSurfaceFollowup?.title ??
      performanceBaselineFollowup?.title ??
      primaryFollowup?.title ??
      primaryAction?.title ??
      `Close the ${linkedSloIds[0] ?? 'top'} launch gap`,
    140,
    'Close the top launch gap',
  );

  const hardeningCommitmentSummary = clampText(
    commitmentShepherd?.recommendedAction ??
      incidentRetroEvidence?.commitmentSummary ??
      trustSurfaceFollowup?.recommendedAction ??
      performanceBaselineFollowup?.recommendedAction ??
      primaryFollowup?.recommendedAction ??
      primaryAction?.summary ??
      data.reviewLoop.narrative ??
      data.reviewDiscipline.summary,
    1000,
    'Refresh the cockpit, pick the clearest systems risk, and close it this week.',
  );

  const notes = [
    `Overall posture is ${summarizeOverallStatus(data.overall.status)}: ${data.overall.narrative}`,
    primaryBlocker ? `Primary blocker: ${primaryBlocker}` : null,
    !primaryBlocker && primaryWatchout ? `Primary watch item: ${primaryWatchout}` : null,
    commitmentShepherd
      ? `Commitment shepherd: ${commitmentShepherd.summary} ${commitmentShepherd.recommendedAction}`
      : null,
    scorecardSync ? `Scorecard sync: ${scorecardSync.summary}` : null,
    incidentSummary ? `Incident response: ${incidentSummary.summary}` : null,
    data.latestTrustSurfaceReview
      ? `Latest trust-surface review: ${data.latestTrustSurfaceReview.reviewDate}. ${data.latestTrustSurfaceReview.summary}`
      : 'Latest trust-surface review: no degraded-state review has been logged yet.',
    trustSurfaceFollowup
      ? `Trust-surface follow-up: ${trustSurfaceFollowup.title}. ${trustSurfaceFollowup.recommendedAction}`
      : null,
    trustSurfaceEvidence?.honestyGap
      ? `Trust-surface honesty gap: ${trustSurfaceEvidence.honestyGap} under ${trustSurfaceEvidence.owner ?? 'Founder + agents'}.`
      : null,
    data.latestPerformanceBaseline
      ? `Latest performance baseline: ${data.latestPerformanceBaseline.baselineDate} on ${data.latestPerformanceBaseline.environment}. ${data.latestPerformanceBaseline.summary}`
      : 'Latest performance baseline: no durable baseline has been logged yet.',
    performanceBaselineFollowup
      ? `Performance baseline follow-up: ${performanceBaselineFollowup.title}. ${performanceBaselineFollowup.recommendedAction}`
      : null,
    performanceBaselineEvidence?.bottleneck
      ? `Performance bottleneck: ${performanceBaselineEvidence.bottleneck} under ${performanceBaselineEvidence.mitigationOwner ?? 'Founder + agents'}.`
      : null,
    incidentRetroEvidence
      ? `Incident retro follow-up: ${incidentRetroEvidence.incidentTitle ?? incidentRetroFollowup?.title}. Carry the permanent fix into the weekly commitment loop.`
      : null,
    primaryFollowup
      ? `Automation follow-up: ${primaryFollowup.title}. ${primaryFollowup.recommendedAction}`
      : `Automation posture: ${data.automationSummary.summary}`,
    data.latestAutomationRun
      ? `Latest sweep: ${data.latestAutomationRun.summary}`
      : 'Latest sweep: no daily sweep has been recorded yet.',
    primaryWin ? `Evidence in hand: ${primaryWin}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    actorType,
    generatedAt,
    reviewDate,
    overallStatus: data.overall.status,
    focusArea,
    topRisk,
    changeNotes: clampText(
      notes.join(' '),
      2000,
      'Review the cockpit, confirm the current posture, and record the next hardening move.',
    ),
    hardeningCommitmentTitle,
    hardeningCommitmentSummary,
    commitmentOwner:
      incidentRetroEvidence?.followUpOwner ??
      trustSurfaceEvidence?.owner ??
      performanceBaselineEvidence?.mitigationOwner ??
      data.latestTrustSurfaceReview?.owner ??
      data.latestPerformanceBaseline?.mitigationOwner ??
      'Founder + agents',
    commitmentDueDate: nextFridayInputValue(new Date(generatedAt)),
    linkedSloIds,
    linkedIncidentId: incidentRetroEvidence?.incidentId ?? null,
  };
}

export function parseLatestSystemsReviewDraft(
  rows: SystemsReviewDraftAuditRow[],
): SystemsReviewDraft | null {
  for (const row of rows) {
    if (row.action !== SYSTEMS_REVIEW_DRAFT_ACTION) continue;
    const parsed = reviewDraftPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    return {
      ...parsed.data,
      generatedAt: parsed.data.generatedAt || row.created_at,
    };
  }

  return null;
}

export function buildSystemsReviewDraftHistory(
  rows: SystemsReviewDraftAuditRow[],
): SystemsAutomationActivityRecord[] {
  const history: SystemsAutomationActivityRecord[] = [];

  for (const row of rows) {
    if (row.action !== SYSTEMS_REVIEW_DRAFT_ACTION) continue;

    const parsed = reviewDraftPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    history.push({
      id: ['review_draft', parsed.data.generatedAt || row.created_at, parsed.data.reviewDate].join(
        ':',
      ),
      type: 'review_draft',
      actorType: parsed.data.actorType,
      statusLabel: parsed.data.actorType === 'cron' ? 'Scheduled draft' : 'Manual draft',
      tone: parsed.data.overallStatus === 'bootstrap' ? 'neutral' : parsed.data.overallStatus,
      title: `Weekly review draft for ${parsed.data.reviewDate}`,
      summary: `${parsed.data.focusArea} ${parsed.data.topRisk}`,
      createdAt: parsed.data.generatedAt || row.created_at,
      actionHref: '/admin/systems/queue?panel=review',
      metricItems: [
        { label: 'Review date', value: parsed.data.reviewDate },
        { label: 'Linked SLOs', value: String(parsed.data.linkedSloIds.length) },
      ],
    });
  }

  return history;
}
