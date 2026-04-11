import { describe, expect, it } from 'vitest';
import {
  buildSystemsPerformanceBaselineFollowupTarget,
  buildSystemsPerformanceBaselineHistory,
  buildSystemsPerformanceBaselinePayload,
  buildSystemsPerformanceBaselineSummary,
  parseSystemsPerformanceBaselineHistory,
  SYSTEMS_PERFORMANCE_BASELINE_ACTION,
} from '@/lib/admin/systemsPerformance';

describe('systems performance baseline helpers', () => {
  it('derives the baseline status from the recorded metrics', () => {
    const payload = buildSystemsPerformanceBaselinePayload({
      actorType: 'manual',
      baselineDate: '2026-04-06',
      environment: 'production',
      scenarioLabel: 'Minimum public read baseline',
      concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
      summary: 'Public read baseline stayed close to target under load.',
      bottleneck: 'The DRep listing path still widened under peak concurrency.',
      mitigationOwner: 'Founder + agents',
      nextStep: 'Trim the DRep payload and rerun after the caching change lands.',
      apiHealthP95Ms: 120,
      apiDrepsP95Ms: 640,
      apiV1DrepsP95Ms: 410,
      governanceHealthP95Ms: 330,
      errorRatePct: 0.6,
      artifactUrl: 'https://example.com/k6/report',
      notes: 'Manual rerun after caching hardening.',
    });

    expect(payload.overallStatus).toBe('warning');
  });

  it('parses durable history and marks stale baselines', () => {
    const history = parseSystemsPerformanceBaselineHistory(
      [
        {
          action: SYSTEMS_PERFORMANCE_BASELINE_ACTION,
          payload: {
            actorType: 'manual',
            baselineDate: '2026-03-10',
            environment: 'production',
            scenarioLabel: 'Minimum public read baseline',
            concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
            summary: 'The public read path slowed under load.',
            bottleneck: 'The DRep listing payload remains too heavy.',
            mitigationOwner: 'Founder + agents',
            nextStep: 'Reduce payload weight and rerun the baseline.',
            apiHealthP95Ms: 110,
            apiDrepsP95Ms: 820,
            apiV1DrepsP95Ms: 470,
            governanceHealthP95Ms: 360,
            errorRatePct: 0.8,
          },
          created_at: '2026-03-10T12:00:00.000Z',
        },
      ],
      new Date('2026-04-06T12:00:00.000Z'),
    );

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      baselineDate: '2026-03-10',
      overallStatus: 'warning',
      isStale: true,
    });
    expect(history[0]?.daysSinceBaseline).toBeGreaterThan(14);
  });

  it('builds a follow-up when the latest baseline is stale or unhealthy', () => {
    const target = buildSystemsPerformanceBaselineFollowupTarget({
      latestBaseline: {
        actorType: 'manual',
        loggedAt: '2026-04-01T12:00:00.000Z',
        baselineDate: '2026-04-01',
        environment: 'production',
        scenarioLabel: 'Minimum public read baseline',
        concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
        overallStatus: 'critical',
        summary: 'The slowest route blew past the launch bar.',
        bottleneck: 'The `/api/dreps` payload still dominates p95 latency.',
        mitigationOwner: 'Founder + agents',
        nextStep: 'Ship the payload trim and rerun the baseline.',
        artifactUrl: null,
        notes: null,
        apiHealthP95Ms: 150,
        apiDrepsP95Ms: 1_260,
        apiV1DrepsP95Ms: 540,
        governanceHealthP95Ms: 380,
        errorRatePct: 2.4,
        maxObservedP95Ms: 1_260,
        daysSinceBaseline: 5,
        isStale: false,
      },
      performanceStatus: 'critical',
    });

    expect(target).toMatchObject({
      sourceKey: 'systems:performance-baseline',
      severity: 'critical',
      reason: 'bottleneck',
    });
    expect(target?.recommendedAction).toMatch(/Ship the payload trim/i);
  });

  it('adds baseline logs into the centralized activity history', () => {
    const history = buildSystemsPerformanceBaselineHistory([
      {
        action: SYSTEMS_PERFORMANCE_BASELINE_ACTION,
        payload: {
          actorType: 'manual',
          baselineDate: '2026-04-06',
          environment: 'production',
          scenarioLabel: 'Minimum public read baseline',
          concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
          summary: 'Public read paths stayed inside the launch bar.',
          bottleneck: 'No new bottleneck broke the target.',
          mitigationOwner: 'Founder + agents',
          nextStep: 'Rerun after the next risky route or caching change.',
          apiHealthP95Ms: 120,
          apiDrepsP95Ms: 410,
          apiV1DrepsP95Ms: 290,
          governanceHealthP95Ms: 300,
          errorRatePct: 0.1,
        },
        created_at: '2026-04-06T13:00:00.000Z',
      },
    ]);

    expect(history[0]).toMatchObject({
      type: 'performance_baseline',
      statusLabel: 'Healthy baseline',
      tone: 'good',
      actionHref: '/admin/systems/evidence?panel=performance',
    });
  });

  it('summarizes missing baseline discipline as bootstrapping', () => {
    const summary = buildSystemsPerformanceBaselineSummary(null);

    expect(summary.status).toBe('bootstrap');
    expect(summary.headline).toMatch(/has not been recorded yet/i);
  });
});
