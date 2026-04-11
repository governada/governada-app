import { z } from 'zod';
import type {
  SystemsAutomationActivityRecord,
  SystemsStatus,
  SystemsTrustSurfaceReviewRecord,
  SystemsTrustSurfaceReviewSummary,
} from '@/lib/admin/systems';

export const SYSTEMS_TRUST_SURFACE_REVIEW_ACTION = 'systems_trust_surface_review_logged';
export const SYSTEMS_TRUST_SURFACE_REVIEW_FRESHNESS_DAYS = 7;

type SystemsTrustSurfaceReviewAuditRow = {
  action: string;
  payload: unknown;
  created_at: string;
};

type SystemsTrustSurfaceReviewRow = {
  actor_type: 'manual' | 'cron';
  created_at: string;
  review_date: string;
  overall_status: SystemsTrustSurfaceReviewRecord['overallStatus'];
  linked_slo_ids: string[] | null;
  reviewed_surfaces: string[] | null;
  summary: string;
  current_user_state: string;
  honesty_gap: string;
  next_fix: string;
  owner: string;
  artifact_url: string | null;
  notes: string | null;
};

export type SystemsTrustSurfaceFollowupTarget = {
  sourceKey: string;
  severity: 'warning' | 'critical';
  title: string;
  summary: string;
  recommendedAction: string;
  actionHref: string;
  reason: 'missing' | 'stale' | 'honesty_gap';
  evidence: Record<string, unknown>;
};

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const systemsStatusSchema = z.enum(['good', 'warning', 'critical']);

const reviewPayloadSchema = z.object({
  actorType: z.enum(['manual', 'cron']),
  reviewDate: dateString,
  overallStatus: systemsStatusSchema,
  linkedSloIds: z.array(z.string().trim().min(1).max(60)).min(1).max(3),
  reviewedSurfaces: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  summary: z.string().trim().min(1).max(500),
  currentUserState: z.string().trim().min(1).max(600),
  honestyGap: z.string().trim().min(1).max(600),
  nextFix: z.string().trim().min(1).max(600),
  owner: z.string().trim().min(1).max(120),
  artifactUrl: z.string().trim().url().nullable().optional(),
  notes: z.string().trim().max(1200).nullable().optional(),
});

export type SystemsTrustSurfaceReviewPayload = z.infer<typeof reviewPayloadSchema>;

function normalizeString(input: string | null | undefined) {
  const cleaned = (input ?? '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeStringArray(input: unknown, maxItems: number) {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .map((value) => (typeof value === 'string' ? normalizeString(value) : null))
        .filter((value): value is string => Boolean(value))
        .slice(0, maxItems),
    ),
  );
}

function reviewAgeDays(reviewDate: string, now = new Date()) {
  const reviewMs = Date.parse(`${reviewDate}T00:00:00Z`);
  const todayMs = Date.parse(now.toISOString().slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.floor((todayMs - reviewMs) / (1000 * 60 * 60 * 24)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function reviewStatusLabel(status: SystemsTrustSurfaceReviewRecord['overallStatus']) {
  switch (status) {
    case 'good':
      return 'Honesty reviewed';
    case 'warning':
      return 'Watch review';
    default:
      return 'Honesty gap';
  }
}

export function buildSystemsTrustSurfaceReviewPayload(input: unknown) {
  const raw = z
    .object({
      actorType: z.enum(['manual', 'cron']).optional(),
      reviewDate: dateString,
      overallStatus: systemsStatusSchema,
      linkedSloIds: z.array(z.string()).optional(),
      reviewedSurfaces: z.array(z.string()).optional(),
      summary: z.string(),
      currentUserState: z.string(),
      honestyGap: z.string(),
      nextFix: z.string(),
      owner: z.string(),
      artifactUrl: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .parse(input);

  return reviewPayloadSchema.parse({
    actorType: raw.actorType ?? 'manual',
    reviewDate: raw.reviewDate,
    overallStatus: raw.overallStatus,
    linkedSloIds: normalizeStringArray(raw.linkedSloIds, 3),
    reviewedSurfaces: normalizeStringArray(raw.reviewedSurfaces, 8),
    summary: normalizeString(raw.summary),
    currentUserState: normalizeString(raw.currentUserState),
    honestyGap: normalizeString(raw.honestyGap),
    nextFix: normalizeString(raw.nextFix),
    owner: normalizeString(raw.owner),
    artifactUrl: normalizeString(raw.artifactUrl),
    notes: normalizeString(raw.notes),
  });
}

export function buildSystemsTrustSurfaceReviewTarget(payload: {
  reviewDate: string;
  overallStatus: SystemsTrustSurfaceReviewPayload['overallStatus'];
  reviewedSurfaces: string[];
}) {
  return `trust-surface-review:${payload.reviewDate}:${payload.overallStatus}:${slugify(payload.reviewedSurfaces.join('-') || 'systems')}`;
}

export function parseSystemsTrustSurfaceReviewHistory(
  rows: SystemsTrustSurfaceReviewAuditRow[],
  now = new Date(),
): SystemsTrustSurfaceReviewRecord[] {
  const history: SystemsTrustSurfaceReviewRecord[] = [];

  for (const row of rows) {
    if (row.action !== SYSTEMS_TRUST_SURFACE_REVIEW_ACTION) continue;

    const parsed = reviewPayloadSchema.safeParse(row.payload);
    if (!parsed.success) continue;

    const daysSinceReview = reviewAgeDays(parsed.data.reviewDate, now);
    history.push({
      actorType: parsed.data.actorType,
      loggedAt: row.created_at,
      reviewDate: parsed.data.reviewDate,
      overallStatus: parsed.data.overallStatus,
      linkedSloIds: parsed.data.linkedSloIds,
      reviewedSurfaces: parsed.data.reviewedSurfaces,
      summary: parsed.data.summary,
      currentUserState: parsed.data.currentUserState,
      honestyGap: parsed.data.honestyGap,
      nextFix: parsed.data.nextFix,
      owner: parsed.data.owner,
      artifactUrl: parsed.data.artifactUrl ?? null,
      notes: parsed.data.notes ?? null,
      daysSinceReview,
      isStale: daysSinceReview > SYSTEMS_TRUST_SURFACE_REVIEW_FRESHNESS_DAYS,
    });
  }

  return history;
}

export function toSystemsTrustSurfaceReviewRecord(
  row: SystemsTrustSurfaceReviewRow,
  now = new Date(),
): SystemsTrustSurfaceReviewRecord {
  const daysSinceReview = reviewAgeDays(row.review_date, now);

  return {
    actorType: row.actor_type,
    loggedAt: row.created_at,
    reviewDate: row.review_date,
    overallStatus: row.overall_status,
    linkedSloIds: row.linked_slo_ids ?? [],
    reviewedSurfaces: row.reviewed_surfaces ?? [],
    summary: row.summary,
    currentUserState: row.current_user_state,
    honestyGap: row.honesty_gap,
    nextFix: row.next_fix,
    owner: row.owner,
    artifactUrl: row.artifact_url,
    notes: row.notes,
    daysSinceReview,
    isStale: daysSinceReview > SYSTEMS_TRUST_SURFACE_REVIEW_FRESHNESS_DAYS,
  };
}

export function buildSystemsTrustSurfaceReviewSummary(input: {
  latestReview: SystemsTrustSurfaceReviewRecord | null;
  reviewRequired: boolean;
  concernStatus: SystemsStatus;
  linkedSloIds: string[];
}): SystemsTrustSurfaceReviewSummary {
  const target = `Review degraded-state trust surfaces within ${SYSTEMS_TRUST_SURFACE_REVIEW_FRESHNESS_DAYS} days whenever availability, freshness, or correctness is not healthy`;

  if (!input.reviewRequired) {
    return {
      status: 'good',
      headline: 'No active degraded-state honesty review is required',
      currentValue: input.latestReview
        ? `Last reviewed ${input.latestReview.reviewDate}`
        : 'No active degraded-state review needed',
      target,
      summary:
        'Availability, freshness, and correctness are currently healthy enough that the cockpit does not need a fresh degraded-state trust audit right now.',
      lastReviewedAt: input.latestReview?.loggedAt ?? null,
      daysSinceReview: input.latestReview?.daysSinceReview ?? null,
      reviewRequired: false,
      linkedSloIds: [],
    };
  }

  if (!input.latestReview) {
    return {
      status: input.concernStatus === 'critical' ? 'critical' : 'warning',
      headline: 'Degraded-state trust surfaces need review',
      currentValue: 'No durable trust-surface review logged',
      target,
      summary:
        'At least one launch-trust signal is degraded, but the cockpit has no durable review of what users currently see and whether that experience is honest.',
      lastReviewedAt: null,
      daysSinceReview: null,
      reviewRequired: true,
      linkedSloIds: input.linkedSloIds,
    };
  }

  if (input.latestReview.overallStatus === 'critical') {
    return {
      status: 'critical',
      headline: 'Latest trust-surface review found misleading degraded-state UX',
      currentValue: `${input.latestReview.reviewDate} review / ${input.latestReview.reviewedSurfaces.length} surface${input.latestReview.reviewedSurfaces.length === 1 ? '' : 's'}`,
      target,
      summary: `${input.latestReview.honestyGap} Owner: ${input.latestReview.owner}.`,
      lastReviewedAt: input.latestReview.loggedAt,
      daysSinceReview: input.latestReview.daysSinceReview,
      reviewRequired: true,
      linkedSloIds: input.latestReview.linkedSloIds,
    };
  }

  if (input.latestReview.isStale) {
    return {
      status: input.concernStatus === 'critical' ? 'critical' : 'warning',
      headline: 'Degraded-state trust review is stale',
      currentValue: `${input.latestReview.daysSinceReview} days since the last review`,
      target,
      summary:
        'Live degradation is still present, but the last trust-surface review is now stale enough that the founder no longer has a current answer for what users are seeing.',
      lastReviewedAt: input.latestReview.loggedAt,
      daysSinceReview: input.latestReview.daysSinceReview,
      reviewRequired: true,
      linkedSloIds: input.latestReview.linkedSloIds,
    };
  }

  if (input.latestReview.overallStatus === 'warning') {
    return {
      status: 'warning',
      headline: 'Latest trust-surface review found an honesty gap to close',
      currentValue: `${input.latestReview.reviewDate} review / ${input.latestReview.reviewedSurfaces.length} surface${input.latestReview.reviewedSurfaces.length === 1 ? '' : 's'}`,
      target,
      summary: `${input.latestReview.honestyGap} Owner: ${input.latestReview.owner}.`,
      lastReviewedAt: input.latestReview.loggedAt,
      daysSinceReview: input.latestReview.daysSinceReview,
      reviewRequired: true,
      linkedSloIds: input.latestReview.linkedSloIds,
    };
  }

  return {
    status: 'good',
    headline: 'Degraded-state trust review is current',
    currentValue: `${input.latestReview.reviewDate} review / ${input.latestReview.reviewedSurfaces.length} surface${input.latestReview.reviewedSurfaces.length === 1 ? '' : 's'}`,
    target,
    summary: `${input.latestReview.currentUserState} Next fix owner: ${input.latestReview.owner}.`,
    lastReviewedAt: input.latestReview.loggedAt,
    daysSinceReview: input.latestReview.daysSinceReview,
    reviewRequired: true,
    linkedSloIds: input.latestReview.linkedSloIds,
  };
}

export function buildSystemsTrustSurfaceFollowupTarget(input: {
  latestReview: SystemsTrustSurfaceReviewRecord | null;
  summary: SystemsTrustSurfaceReviewSummary;
}): SystemsTrustSurfaceFollowupTarget | null {
  if (!input.summary.reviewRequired) return null;

  if (!input.latestReview) {
    return {
      sourceKey: 'systems:trust-surface-review',
      severity: input.summary.status === 'critical' ? 'critical' : 'warning',
      title:
        input.summary.status === 'critical'
          ? 'Review degraded-state trust surfaces now'
          : 'Review degraded-state trust surfaces soon',
      summary: input.summary.summary,
      recommendedAction:
        'Open the Evidence workspace, inspect what public and operator users actually see, and log the next honesty fix with an owner.',
      actionHref: '/admin/systems/evidence?panel=trust',
      reason: 'missing',
      evidence: {
        reason: 'missing',
        linkedSloIds: input.summary.linkedSloIds,
        reviewDate: null,
        owner: null,
      },
    };
  }

  if (input.latestReview.overallStatus !== 'good') {
    return {
      sourceKey: 'systems:trust-surface-review',
      severity: input.latestReview.overallStatus === 'critical' ? 'critical' : 'warning',
      title: 'Close the degraded-state honesty gap',
      summary: input.latestReview.honestyGap,
      recommendedAction: `${input.latestReview.owner} owns the next fix: ${input.latestReview.nextFix}`,
      actionHref: '/admin/systems/evidence?panel=trust',
      reason: 'honesty_gap',
      evidence: {
        reason: 'honesty_gap',
        reviewDate: input.latestReview.reviewDate,
        linkedSloIds: input.latestReview.linkedSloIds,
        owner: input.latestReview.owner,
        honestyGap: input.latestReview.honestyGap,
        reviewedSurfaces: input.latestReview.reviewedSurfaces,
      },
    };
  }

  if (input.latestReview.isStale) {
    return {
      sourceKey: 'systems:trust-surface-review',
      severity: input.summary.status === 'critical' ? 'critical' : 'warning',
      title: 'Refresh the degraded-state trust review',
      summary:
        'The latest degraded-state trust review is stale while launch-trust signals are still degraded.',
      recommendedAction:
        'Recheck the affected trust surfaces, confirm the user-facing state is still honest, and log any new honesty fix in the Evidence workspace.',
      actionHref: '/admin/systems/evidence?panel=trust',
      reason: 'stale',
      evidence: {
        reason: 'stale',
        reviewDate: input.latestReview.reviewDate,
        linkedSloIds: input.latestReview.linkedSloIds,
        owner: input.latestReview.owner,
        daysSinceReview: input.latestReview.daysSinceReview,
      },
    };
  }

  return null;
}

export function buildSystemsTrustSurfaceReviewHistory(
  rows: SystemsTrustSurfaceReviewAuditRow[],
): SystemsAutomationActivityRecord[] {
  const history: SystemsAutomationActivityRecord[] = [];

  for (const entry of parseSystemsTrustSurfaceReviewHistory(rows)) {
    history.push({
      id: ['trust_surface_review', entry.loggedAt, entry.reviewDate].join(':'),
      type: 'trust_surface_review',
      actorType: entry.actorType,
      statusLabel: reviewStatusLabel(entry.overallStatus),
      tone: entry.overallStatus,
      title: `Trust-surface review for ${entry.reviewDate}`,
      summary: `${entry.summary} Honesty gap: ${entry.honestyGap}`,
      createdAt: entry.loggedAt,
      actionHref: '/admin/systems/evidence?panel=trust',
      metricItems: [
        { label: 'Linked SLOs', value: String(entry.linkedSloIds.length) },
        { label: 'Surfaces', value: String(entry.reviewedSurfaces.length) },
        { label: 'Owner', value: entry.owner },
      ],
    });
  }

  return history;
}
