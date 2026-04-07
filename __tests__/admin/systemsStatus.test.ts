import { describe, expect, it } from 'vitest';
import { CRITICAL_JOURNEYS, summarizeJourneyCoverage, worstStatus } from '@/lib/admin/systems';
import { buildSystemsLaunchControlRoom } from '@/lib/admin/systemsLaunchControl';
import {
  buildOverallNarrative,
  buildSloCards,
  buildWeeklyReviewLoop,
} from '@/lib/admin/systemsStatus';

describe('systems helpers', () => {
  it('summarizes journey coverage across launch-critical journeys', () => {
    const summary = summarizeJourneyCoverage(CRITICAL_JOURNEYS);

    expect(summary.totalCount).toBeGreaterThan(0);
    expect(summary.automatedCount).toBeGreaterThan(0);
    expect(summary.percent).toBeGreaterThan(0);
    expect(summary.status).toBe('warning');
  });

  it('returns the worst status from a set', () => {
    expect(worstStatus(['good', 'bootstrap'])).toBe('bootstrap');
    expect(worstStatus(['good', 'warning', 'bootstrap'])).toBe('warning');
    expect(worstStatus(['good', 'warning', 'critical'])).toBe('critical');
  });

  it('builds a warning narrative when foundations exist but gaps remain', () => {
    const narrative = buildOverallNarrative([
      {
        id: 'availability',
        title: 'Availability',
        status: 'good',
        confidence: 'live',
        metricLabel: 'Dependency health',
        currentValue: '3/3 healthy',
        target: 'Healthy or degraded, never critical',
        summary: 'All dependencies are healthy.',
        actionLabel: 'Inspect pipeline',
        actionHref: '/admin/pipeline',
      },
      {
        id: 'journeys',
        title: 'Critical journey success',
        status: 'warning',
        confidence: 'partial',
        metricLabel: 'Automated coverage',
        currentValue: '7/13 critical journeys',
        target: 'All L0 protected pre-merge; L1 deterministic where possible',
        summary: 'Workspace flows are not fully protected.',
        actionLabel: 'Review journeys',
        actionHref: '/admin/systems#journeys',
      },
      {
        id: 'incident-response',
        title: 'Incident response',
        status: 'bootstrap',
        confidence: 'bootstrap',
        metricLabel: 'Operator readiness',
        currentValue: 'Alerts exist, drills not started',
        target: 'Alert, acknowledge, mitigate, learn',
        summary: 'Drills are not routine yet.',
        actionLabel: 'Run first drill',
        actionHref: '/admin/systems#automation',
      },
    ]);

    expect(narrative.status).toBe('warning');
    expect(narrative.headline).toMatch(/Foundations are strong/i);
  });

  it('builds the first formal launch SLO set', () => {
    const slos = buildSloCards({
      availability: {
        status: 'good',
        summary: 'All dependencies are healthy.',
        value: '3/3 healthy',
      },
      freshness: {
        status: 'warning',
        summary: 'Freshness is drifting.',
        value: 'Fast 52m / Full 10h',
      },
      correctness: {
        status: 'good',
        summary: 'Correctness is clean.',
        value: '99.2% vote power / 0.3% mismatch',
      },
      performance: {
        status: 'warning',
        summary: 'Performance is serviceable but not ideal.',
        value: 'p95 620ms / 1.4% 5xx',
      },
      changeSafety: {
        status: 'bootstrap',
        summary: 'Weekly operating loop is not yet routine.',
        value: 'Weekly scorecard not started',
      },
      incidentResponse: {
        status: 'bootstrap',
        summary: 'Drills are not routine yet.',
        value: 'Alerts exist, drills not started',
      },
      userHonesty: {
        status: 'bootstrap',
        summary: 'Trust surfaces need review.',
        value: 'Needs recurring trust-surface review',
      },
    });

    expect(slos).toHaveLength(5);
    expect(slos[1]?.id).toBe('freshness');
    expect(slos[1]?.status).toBe('warning');
    expect(slos[4]?.id).toBe('journeys');
  });

  it('builds a weekly review loop anchored to the current focus', () => {
    const slos = buildSloCards({
      availability: {
        status: 'good',
        summary: 'All dependencies are healthy.',
        value: '3/3 healthy',
      },
      freshness: {
        status: 'critical',
        summary: 'Freshness is outside the launch bar.',
        value: 'Fast 140m / Full 30h',
      },
      correctness: {
        status: 'good',
        summary: 'Correctness is clean.',
        value: '99.2% vote power / 0.3% mismatch',
      },
      performance: {
        status: 'good',
        summary: 'Performance is within the launch bar.',
        value: 'p95 320ms / 0.1% 5xx',
      },
      changeSafety: {
        status: 'bootstrap',
        summary: 'Weekly operating loop is not yet routine.',
        value: 'Weekly scorecard not started',
      },
      incidentResponse: {
        status: 'bootstrap',
        summary: 'Drills are not routine yet.',
        value: 'Alerts exist, drills not started',
      },
      userHonesty: {
        status: 'bootstrap',
        summary: 'Trust surfaces need review.',
        value: 'Needs recurring trust-surface review',
      },
    });

    const reviewLoop = buildWeeklyReviewLoop(slos, [
      {
        id: 'record-baseline',
        title: 'Refresh the performance baseline',
        priority: 'P1',
        timeframe: 'this-week',
        summary: 'Performance needs a real baseline.',
        href: '/admin/systems#performance-baseline',
        automationReady: true,
      },
    ]);

    expect(reviewLoop.currentFocus).toMatch(/Refresh the performance baseline/i);
    expect(reviewLoop.steps).toHaveLength(4);
    expect(reviewLoop.steps.every((step) => step.automationReady)).toBe(true);
  });

  it('builds a blocked launch control room when core promises and journeys are not ready', () => {
    const slos = buildSloCards({
      availability: {
        status: 'critical',
        summary: 'Core availability is red.',
        value: '1/3 healthy',
      },
      freshness: {
        status: 'warning',
        summary: 'Freshness is drifting.',
        value: 'Fast 58m / Full 8h',
      },
      correctness: {
        status: 'good',
        summary: 'Correctness is clean.',
        value: '99.2% vote power / 0.3% mismatch',
      },
      performance: {
        status: 'warning',
        summary: 'Performance is above the ideal launch bar.',
        value: 'p95 620ms / 1.4% 5xx',
      },
      changeSafety: {
        status: 'warning',
        summary: 'Weekly operating loop is slipping.',
        value: 'Last reviewed 10 days ago',
      },
      incidentResponse: {
        status: 'warning',
        summary: 'Drill cadence is not current.',
        value: '0 open incidents / no drill yet',
      },
      userHonesty: {
        status: 'critical',
        summary: 'The latest trust review found a misleading degraded state.',
        value: '2026-04-06 review / 2 surfaces',
      },
    });

    const room = buildSystemsLaunchControlRoom({
      slos,
      journeys: CRITICAL_JOURNEYS.map((journey) =>
        journey.id === 'J01' ? { ...journey, coverage: 'manual' } : journey,
      ),
      reviewDiscipline: {
        status: 'warning',
        headline: 'Weekly review rhythm is slipping',
        currentValue: 'Last reviewed 10 days ago',
        target: 'A founder review recorded every 7 days',
        summary: 'Refresh the scorecard before the loop loses credibility.',
        lastReviewedAt: '2026-04-01T12:00:00.000Z',
        openCommitments: 2,
        overdueCommitments: 1,
      },
      scorecardSync: {
        status: 'warning',
        headline: 'Live posture has drifted from the last review',
        currentValue: '2 reviews / 2-week streak',
        target: 'A fresh weekly review within 7 days that matches the live cockpit',
        summary: 'The durable review needs to catch up to the live posture.',
        reviewCount: 2,
        weeklyStreak: 2,
        liveStatus: 'critical',
        lastReviewStatus: 'warning',
        lastReviewedAt: '2026-04-01T12:00:00.000Z',
        driftSloIds: ['availability'],
        hotspotSloIds: ['availability', 'journeys'],
        trend: 'worsening',
        recentReviews: [],
      },
      incidentSummary: {
        status: 'warning',
        headline: 'Failure drills have not started yet',
        currentValue: '0 open incidents / no drill yet',
        target: 'Monthly drills with no unresolved high-severity incidents',
        summary: 'Run the first tabletop drill.',
        lastDrillAt: null,
        lastIncidentAt: null,
        openIncidentCount: 0,
        drillCount: 0,
        recentEntries: [],
      },
      performanceBaselineSummary: {
        status: 'warning',
        headline: 'Performance baseline is stale',
        currentValue: '24 days since the last baseline',
        target: 'A fresh baseline every 14 days and after risky route changes',
        summary: 'The latest baseline is stale.',
        lastRecordedAt: '2026-03-12T12:00:00.000Z',
        daysSinceBaseline: 24,
      },
      trustSurfaceReviewSummary: {
        status: 'critical',
        headline: 'Latest trust-surface review found misleading degraded-state UX',
        currentValue: '2026-04-06 review / 2 surfaces',
        target:
          'Review degraded-state trust surfaces within 7 days whenever availability, freshness, or correctness is not healthy',
        summary: 'The latest review found a launch-blocking honesty gap.',
        lastReviewedAt: '2026-04-06T12:00:00.000Z',
        daysSinceReview: 0,
        reviewRequired: true,
        linkedSloIds: ['availability'],
      },
      automationSummary: {
        status: 'critical',
        headline: 'Critical follow-ups still need founder action',
        currentValue: '2 open follow-ups',
        target: 'A fresh sweep each day and zero unresolved critical follow-ups',
        summary: 'The sweep surfaced unresolved critical work.',
        lastSweepAt: '2026-04-06T12:00:00.000Z',
      },
      automationFollowups: [
        {
          sourceKey: 'systems:review-discipline',
          triggerType: 'review_discipline',
          severity: 'critical',
          status: 'open',
          title: 'Refresh the weekly systems review now',
          summary: 'The review loop is stale.',
          recommendedAction: 'Log a fresh review.',
          actionHref: '/admin/systems#weekly-review',
          updatedAt: '2026-04-06T12:00:00.000Z',
        },
      ],
    });

    expect(room.decision).toBe('blocked');
    expect(room.blockerCount).toBeGreaterThan(0);
    expect(room.checklist.some((item) => item.decision === 'blocked')).toBe(true);
    expect(room.headline).toMatch(/blocked/i);
  });
});
