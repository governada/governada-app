import { z } from 'zod';
import type { SystemsDashboardData, SystemsReviewDraft, SystemsStatus } from '@/lib/admin/systems';

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

function buildLinkedSloIds(data: SystemsDashboardData) {
  const nonGood = data.slos.filter((slo) => slo.status !== 'good').map((slo) => slo.id);
  if (nonGood.length > 0) return nonGood.slice(0, 3);
  return data.slos.slice(0, 1).map((slo) => slo.id);
}

export function buildSystemsReviewDraft(
  data: SystemsDashboardData,
  actorType: 'manual' | 'cron',
): SystemsReviewDraft {
  const generatedAt = new Date().toISOString();
  const reviewDate = todayInputValue(new Date(generatedAt));
  const linkedSloIds = buildLinkedSloIds(data);
  const primaryAction = data.actions[0] ?? null;
  const primaryFollowup = data.automationFollowups[0] ?? null;
  const primaryBlocker = data.story.blockers[0] ?? null;
  const primaryWatchout = data.story.watchouts[0] ?? null;
  const primaryWin = data.story.wins[0] ?? null;

  const focusArea = clampText(
    primaryFollowup?.title ?? primaryAction?.title ?? data.reviewLoop.currentFocus,
    120,
    'Launch systems hardening',
  );

  const topRisk = clampText(
    primaryBlocker ?? primaryFollowup?.summary ?? primaryWatchout ?? data.overall.narrative,
    500,
    'The operating posture needs a fresh founder review.',
  );

  const hardeningCommitmentTitle = clampText(
    primaryFollowup?.title ??
      primaryAction?.title ??
      `Close the ${linkedSloIds[0] ?? 'top'} launch gap`,
    140,
    'Close the top launch gap',
  );

  const hardeningCommitmentSummary = clampText(
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
    commitmentOwner: 'Founder + agents',
    commitmentDueDate: nextFridayInputValue(new Date(generatedAt)),
    linkedSloIds,
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
