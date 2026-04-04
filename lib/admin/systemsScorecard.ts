import {
  statusRank,
  type SystemsReviewRecord,
  type SystemsScorecardReviewRecord,
  type SystemsScorecardSync,
  type SystemsScorecardTrend,
  type SystemsStatus,
} from '@/lib/admin/systems';

const SCORECARD_STREAK_WINDOW_DAYS = 8;
const REVIEW_STALE_WARNING_DAYS = 8;
const REVIEW_STALE_CRITICAL_DAYS = 14;

function reviewedDaysAgo(reviewedAt: string, now: Date) {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(reviewedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function countWeeklyStreak(reviews: SystemsReviewRecord[]) {
  if (reviews.length === 0) return 0;

  let streak = 1;
  for (let index = 0; index < reviews.length - 1; index += 1) {
    const current = reviews[index];
    const next = reviews[index + 1];
    if (!current || !next) break;

    const gapDays = Math.floor(
      (new Date(current.reviewedAt).getTime() - new Date(next.reviewedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (gapDays > SCORECARD_STREAK_WINDOW_DAYS) break;
    streak += 1;
  }

  return streak;
}

function buildHotspotSloIds(reviews: SystemsReviewRecord[], limit = 3) {
  const counts = new Map<string, number>();

  for (const review of reviews.slice(0, 6)) {
    for (const sloId of review.linkedSloIds) {
      counts.set(sloId, (counts.get(sloId) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (left[1] !== right[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([sloId]) => sloId);
}

function buildRecentReviews(reviews: SystemsReviewRecord[]): SystemsScorecardReviewRecord[] {
  return reviews.slice(0, 6).map((review) => ({
    id: review.id,
    reviewDate: review.reviewDate,
    reviewedAt: review.reviewedAt,
    overallStatus: review.overallStatus,
    focusArea: review.focusArea,
    linkedSloIds: review.linkedSloIds,
    commitmentTitle: review.commitment?.title ?? null,
    commitmentStatus: review.commitment?.status ?? null,
  }));
}

function buildTrend(
  latest: SystemsReviewRecord | undefined,
  previous: SystemsReviewRecord | undefined,
): SystemsScorecardTrend {
  if (!latest || !previous) return 'new';

  const latestRank = statusRank(latest.overallStatus);
  const previousRank = statusRank(previous.overallStatus);

  if (latestRank < previousRank) return 'improving';
  if (latestRank > previousRank) return 'worsening';
  return 'steady';
}

function summarizeStatus(status: SystemsStatus) {
  switch (status) {
    case 'good':
      return 'green';
    case 'warning':
      return 'yellow';
    case 'critical':
      return 'red';
    default:
      return 'bootstrapping';
  }
}

export function buildSystemsScorecardSync(input: {
  reviewHistory: SystemsReviewRecord[];
  liveStatus: SystemsStatus;
  liveConcernSloIds: string[];
  now?: Date;
}): SystemsScorecardSync {
  const now = input.now ?? new Date();
  const latestReview = input.reviewHistory[0];
  const previousReview = input.reviewHistory[1];

  if (!latestReview) {
    return {
      status: 'critical',
      headline: 'Weekly scorecard history has not started yet',
      currentValue: '0 reviews / 0-week streak',
      target: 'A fresh weekly review within 7 days that matches the live cockpit',
      summary:
        'The live cockpit exists, but there is no durable weekly scorecard trail yet. Log the first founder review so launch confidence stops living only in the current snapshot.',
      reviewCount: 0,
      weeklyStreak: 0,
      liveStatus: input.liveStatus,
      lastReviewStatus: null,
      lastReviewedAt: null,
      driftSloIds: input.liveConcernSloIds,
      hotspotSloIds: [],
      trend: 'new',
      recentReviews: [],
    };
  }

  const reviewCount = input.reviewHistory.length;
  const weeklyStreak = countWeeklyStreak(input.reviewHistory);
  const ageDays = reviewedDaysAgo(latestReview.reviewedAt, now);
  const driftSloIds = input.liveConcernSloIds.filter(
    (sloId) => !latestReview.linkedSloIds.includes(sloId),
  );
  const liveStatusRank = statusRank(input.liveStatus);
  const latestStatusRank = statusRank(latestReview.overallStatus);
  const liveDrift = input.liveStatus !== latestReview.overallStatus;

  let status: SystemsStatus = 'good';
  if (ageDays > REVIEW_STALE_CRITICAL_DAYS) {
    status = 'critical';
  } else if (ageDays > REVIEW_STALE_WARNING_DAYS || liveDrift || driftSloIds.length > 0) {
    status = 'warning';
  }

  let headline = 'Weekly scorecard is synced with the live cockpit';
  let summary =
    weeklyStreak > 1
      ? `The latest logged review still reflects the live posture, and the weekly scorecard has a ${weeklyStreak}-week streak.`
      : 'The latest logged review still reflects the live posture, but the weekly streak is only one review deep so the habit is not yet proven.';

  if (status === 'critical') {
    headline = 'Weekly scorecard is stale';
    summary = `The last logged systems review is ${ageDays} days old. Refresh the weekly review so the durable scorecard can be trusted again.`;
  } else if (liveDrift || driftSloIds.length > 0) {
    const driftLabel =
      liveStatusRank > latestStatusRank
        ? 'worse'
        : liveStatusRank < latestStatusRank
          ? 'better'
          : 'different';
    const focusLabel =
      driftSloIds.length > 0 ? ` Missing live focus: ${driftSloIds.join(', ')}.` : '';
    headline = 'Live posture has drifted from the last logged review';
    summary = `The cockpit is currently ${driftLabel} than the last durable review (${summarizeStatus(
      input.liveStatus,
    )} now vs ${summarizeStatus(latestReview.overallStatus)} then). Refresh the scorecard so the weekly record matches the current risk.${focusLabel}`;
  } else if (ageDays > REVIEW_STALE_WARNING_DAYS) {
    headline = 'Weekly scorecard needs a fresh review soon';
    summary = `The last logged systems review is ${ageDays} days old. The posture still lines up today, but the weekly scorecard is close to drifting stale.`;
  }

  return {
    status,
    headline,
    currentValue: `${reviewCount} review${reviewCount === 1 ? '' : 's'} / ${weeklyStreak}-week streak`,
    target: 'A fresh weekly review within 7 days that matches the live cockpit',
    summary,
    reviewCount,
    weeklyStreak,
    liveStatus: input.liveStatus,
    lastReviewStatus: latestReview.overallStatus,
    lastReviewedAt: latestReview.reviewedAt,
    driftSloIds,
    hotspotSloIds: buildHotspotSloIds(input.reviewHistory),
    trend: buildTrend(latestReview, previousReview),
    recentReviews: buildRecentReviews(input.reviewHistory),
  };
}
