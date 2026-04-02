import { describe, expect, it } from 'vitest';
import { CRITICAL_JOURNEYS, summarizeJourneyCoverage, worstStatus } from '@/lib/admin/systems';
import { buildOverallNarrative } from '@/lib/admin/systemsStatus';

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
});
