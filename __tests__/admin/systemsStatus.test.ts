import { describe, expect, it } from 'vitest';
import { CRITICAL_JOURNEYS, summarizeJourneyCoverage, worstStatus } from '@/lib/admin/systems';
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
});
