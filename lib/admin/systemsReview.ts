import { z } from 'zod';
import type {
  SystemsCommitmentCard,
  SystemsCommitmentStatus,
  SystemsReviewDiscipline,
  SystemsReviewRecord,
  SystemsStatus,
} from '@/lib/admin/systems';

type SystemsReviewRow = {
  id: string;
  review_date: string;
  reviewed_at: string;
  overall_status: SystemsStatus;
  focus_area: string;
  summary: string;
  top_risk: string;
  change_notes: string | null;
  linked_slo_ids: string[] | null;
};

type SystemsCommitmentRow = {
  id: string;
  review_id: string | null;
  title: string;
  summary: string | null;
  owner: string;
  status: SystemsCommitmentStatus;
  due_date: string | null;
  linked_slo_ids: string[] | null;
  created_at: string;
};

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createSystemsReviewSchema = z.object({
  reviewDate: dateString,
  overallStatus: z.enum(['good', 'warning', 'critical', 'bootstrap']),
  focusArea: z.string().trim().min(3).max(120),
  topRisk: z.string().trim().min(10).max(500),
  changeNotes: z.string().trim().min(10).max(2000),
  hardeningCommitmentTitle: z.string().trim().min(5).max(140),
  hardeningCommitmentSummary: z.string().trim().min(10).max(1000),
  commitmentOwner: z.string().trim().min(2).max(120),
  commitmentDueDate: dateString.nullable().optional(),
  linkedSloIds: z.array(z.string().trim().min(1)).max(5),
});

export const updateSystemsCommitmentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['planned', 'in_progress', 'blocked', 'done']),
});

export function summarizeReview(topRisk: string, changeNotes: string) {
  const candidate = changeNotes.trim() || topRisk.trim();
  return candidate.length <= 180 ? candidate : `${candidate.slice(0, 177).trimEnd()}...`;
}

export function toSystemsCommitment(row: SystemsCommitmentRow): SystemsCommitmentCard {
  const dueDate = row.due_date ?? null;
  const dueTime = dueDate ? new Date(`${dueDate}T00:00:00Z`).getTime() : null;
  const now = Date.now();
  const createdAt = new Date(row.created_at).getTime();
  const ageDays = Number.isFinite(createdAt)
    ? Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    id: row.id,
    reviewId: row.review_id,
    title: row.title,
    summary: row.summary?.trim() || 'No commitment summary recorded yet.',
    owner: row.owner,
    status: row.status,
    dueDate,
    linkedSloIds: row.linked_slo_ids ?? [],
    createdAt: row.created_at,
    isOverdue: row.status !== 'done' && dueTime !== null && dueTime < now,
    ageDays,
  };
}

export function toSystemsReviewRecord(
  row: SystemsReviewRow,
  commitment?: SystemsCommitmentCard | null,
): SystemsReviewRecord {
  return {
    id: row.id,
    reviewDate: row.review_date,
    reviewedAt: row.reviewed_at,
    overallStatus: row.overall_status,
    focusArea: row.focus_area,
    summary: row.summary,
    topRisk: row.top_risk,
    changeNotes: row.change_notes,
    linkedSloIds: row.linked_slo_ids ?? [],
    commitment: commitment
      ? {
          id: commitment.id,
          title: commitment.title,
          owner: commitment.owner,
          status: commitment.status,
          dueDate: commitment.dueDate,
        }
      : null,
  };
}

export function buildReviewDiscipline(
  reviews: SystemsReviewRecord[],
  openCommitments: SystemsCommitmentCard[],
): SystemsReviewDiscipline {
  const lastReview = reviews[0] ?? null;
  const overdueCommitments = openCommitments.filter((commitment) => commitment.isOverdue).length;

  if (!lastReview) {
    return {
      status: 'critical',
      headline: 'No weekly systems review logged yet',
      currentValue: '0 recent reviews',
      target: 'A founder review recorded every 7 days',
      summary:
        'The cockpit can show posture, but the operating loop is still missing durable review history and named hardening follow-through.',
      lastReviewedAt: null,
      openCommitments: openCommitments.length,
      overdueCommitments,
    };
  }

  const reviewAgeDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(lastReview.reviewedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  let status: SystemsStatus = 'good';
  if (reviewAgeDays > 14 || overdueCommitments >= 2) status = 'critical';
  else if (reviewAgeDays > 8 || overdueCommitments >= 1) status = 'warning';

  const headline =
    status === 'good'
      ? 'Weekly review rhythm is on track'
      : status === 'warning'
        ? 'Weekly review rhythm is slipping'
        : 'Operating rhythm needs intervention';

  const currentValue =
    reviewAgeDays === 0
      ? 'Reviewed today'
      : `Last reviewed ${reviewAgeDays} day${reviewAgeDays === 1 ? '' : 's'} ago`;

  let summary =
    status === 'good'
      ? 'The latest weekly review is fresh, and open commitments are still within their expected window.'
      : status === 'warning'
        ? 'The review loop exists, but it is starting to drift. Refresh the scorecard and clear overdue hardening work before the loop loses credibility.'
        : 'The review loop is stale or overdue work is piling up. Treat this as an operating gap, not a documentation gap.';

  if (openCommitments.length === 0) {
    summary =
      'A fresh weekly review exists, but there is no open hardening commitment recorded right now. The loop should always leave behind one concrete next move.';
  }

  return {
    status,
    headline,
    currentValue,
    target: 'A founder review recorded every 7 days',
    summary,
    lastReviewedAt: lastReview.reviewedAt,
    openCommitments: openCommitments.length,
    overdueCommitments,
  };
}
