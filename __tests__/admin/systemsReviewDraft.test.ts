import { describe, expect, it } from 'vitest';
import type { SystemsDashboardData } from '@/lib/admin/systems';
import {
  buildSystemsReviewDraftHistory,
  buildSystemsReviewDraft,
  parseLatestSystemsReviewDraft,
  SYSTEMS_REVIEW_DRAFT_ACTION,
} from '@/lib/admin/systemsReviewDraft';

function buildDashboardFixture(): SystemsDashboardData {
  return {
    generatedAt: '2026-04-02T12:00:00.000Z',
    overall: {
      status: 'warning',
      headline: 'Launch posture needs focused hardening',
      narrative: 'Freshness is close to the edge and operator discipline needs one strong week.',
      dataConfidence: 'live',
    },
    story: {
      wins: ['Core dependency probes are green right now.'],
      watchouts: ['Freshness is drifting toward stale territory.'],
      blockers: ['Weekly review rhythm is stale and needs immediate attention.'],
    },
    summary: {
      dependencyHealth: '3/3 healthy',
      syncSuccessRate: '97% last 24h',
      integrityState: 'Watch',
      apiPerformance: 'p95 480ms',
      criticalJourneyCoverage: '6/12 automated',
    },
    slos: [
      {
        id: 'freshness',
        title: 'Freshness',
        status: 'warning',
        objective: 'Keep sync freshness inside the launch bar.',
        sli: 'Fresh and full sync age',
        currentValue: 'Fast 58m / Full 8h',
        target: 'Fast <45m / Full <12h',
        alertThreshold: 'Fast >45m or Full >12h',
        summary: 'Freshness is drifting.',
        actionLabel: 'Open pipeline',
        actionHref: '/admin/pipeline',
      },
      {
        id: 'journeys',
        title: 'Journeys',
        status: 'warning',
        objective: 'Protect critical journeys with deterministic coverage.',
        sli: 'Automated journey count',
        currentValue: '6/12 automated',
        target: '>=80% of critical journeys automated',
        alertThreshold: '<50% automated',
        summary: 'Too many critical paths still rely on manual checks.',
        actionLabel: 'Open systems',
        actionHref: '/admin/systems#journeys',
      },
    ],
    promises: [],
    actions: [
      {
        id: 'refresh-weekly-review',
        title: 'Refresh the weekly systems review now',
        priority: 'P0',
        timeframe: 'now',
        summary: 'The operating loop is stale and needs a fresh founder review.',
        href: '/admin/systems#weekly-review',
        automationReady: true,
      },
    ],
    reviewLoop: {
      cadence: 'Weekly',
      owner: 'Founder + agents',
      duration: '25 minutes',
      output: 'One review and one commitment',
      currentFocus: 'Protect the launch trust surfaces',
      narrative: 'Use the cockpit to leave behind one concrete hardening move every week.',
      steps: [],
    },
    reviewDiscipline: {
      status: 'critical',
      headline: 'Operating rhythm needs intervention',
      currentValue: 'Last reviewed 16 days ago',
      target: 'A founder review recorded every 7 days',
      summary: 'The review loop is stale or overdue work is piling up.',
      lastReviewedAt: '2026-03-17T12:00:00.000Z',
      openCommitments: 2,
      overdueCommitments: 1,
    },
    scorecardSync: {
      status: 'warning',
      headline: 'Live posture has drifted from the last logged review',
      currentValue: '2 reviews / 2-week streak',
      target: 'A fresh weekly review within 7 days that matches the live cockpit',
      summary:
        'The cockpit is currently different than the last durable review. Refresh the scorecard so the weekly record matches the current risk.',
      reviewCount: 2,
      weeklyStreak: 2,
      liveStatus: 'warning',
      lastReviewStatus: 'critical',
      lastReviewedAt: '2026-03-17T12:00:00.000Z',
      driftSloIds: ['freshness'],
      hotspotSloIds: ['freshness', 'journeys'],
      trend: 'improving',
      recentReviews: [],
    },
    incidentSummary: {
      status: 'warning',
      headline: 'Failure drills have not started yet',
      currentValue: '0 open incidents / no drill yet',
      target: 'Monthly drills with no unresolved high-severity incidents',
      summary:
        'No incidents or drills are logged yet. Run the first tabletop drill so response readiness stops living only in the runbook.',
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
      target: 'A fresh baseline every 14 days and after risky route or caching changes',
      summary:
        'The latest minimum-load baseline is stale, so performance changes can land without a fresh load signal.',
      lastRecordedAt: '2026-03-09T12:00:00.000Z',
      daysSinceBaseline: 24,
    },
    automationSummary: {
      status: 'warning',
      headline: 'Automation is active, but it still needs founder follow-through',
      currentValue: '2 open follow-ups',
      target: 'A fresh sweep each day and zero unresolved critical follow-ups',
      summary: 'The sweep is surfacing useful follow-ups that still need founder action.',
      lastSweepAt: '2026-04-02T11:55:00.000Z',
    },
    automationFollowups: [
      {
        sourceKey: 'systems:review-discipline',
        triggerType: 'review_discipline',
        severity: 'critical',
        status: 'open',
        title: 'Refresh the weekly systems review now',
        summary: 'The review loop is stale or overdue work is piling up.',
        recommendedAction:
          'Open the weekly operating loop, log a fresh review, and leave behind one named hardening commitment for the week.',
        actionHref: '/admin/systems#weekly-review',
        evidence: { overdueCommitments: 1 },
        updatedAt: '2026-04-02T11:55:00.000Z',
      },
    ],
    automationHistory: [],
    latestAutomationRun: {
      actorType: 'cron',
      status: 'warning',
      summary: 'Sweep surfaced 2 warning-level follow-ups for the founder operating loop.',
      followupCount: 2,
      criticalCount: 1,
      openedCount: 1,
      updatedCount: 1,
      resolvedCount: 0,
      createdAt: '2026-04-02T11:55:00.000Z',
    },
    latestOperatorEscalation: null,
    latestCommitmentShepherd: {
      actorType: 'cron',
      status: 'focus',
      title: 'Commitment shepherd: Repair scorecard drift',
      summary: 'Repair scorecard drift is blocked and needs a clear unblock-or-replace decision.',
      recommendedAction:
        'Open the commitment card, confirm the blocker, and decide today whether to unblock it or replace it in the next review.',
      commitmentId: '4375fe7d-f712-48d5-ac2a-c17b62d8d7ce',
      commitmentTitle: 'Repair scorecard drift',
      commitmentStatus: 'blocked',
      owner: 'Founder + agents',
      dueDate: '2026-04-04',
      reason: 'blocked',
      actionHref: '/admin/systems#commitment-4375fe7d-f712-48d5-ac2a-c17b62d8d7ce',
      createdAt: '2026-04-02T11:55:00.000Z',
    },
    latestPerformanceBaseline: {
      actorType: 'manual',
      loggedAt: '2026-03-09T12:00:00.000Z',
      baselineDate: '2026-03-09',
      environment: 'production',
      scenarioLabel: 'Minimum public read baseline',
      concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
      overallStatus: 'warning',
      summary: 'The public read path is drifting above the ideal load target.',
      bottleneck: 'The DRep listing payload remains the slowest public path.',
      mitigationOwner: 'Founder + agents',
      nextStep: 'Trim the payload and rerun the baseline.',
      artifactUrl: null,
      notes: null,
      apiHealthP95Ms: 110,
      apiDrepsP95Ms: 680,
      apiV1DrepsP95Ms: 430,
      governanceHealthP95Ms: 360,
      errorRatePct: 0.8,
      maxObservedP95Ms: 680,
      daysSinceBaseline: 24,
      isStale: true,
    },
    suggestedReviewDraft: null,
    automationOpenCommitments: [],
    openCommitments: [],
    reviewHistory: [],
    incidentHistory: [],
    performanceBaselineHistory: [],
    journeys: [],
    automationCandidates: [],
    quickLinks: [],
  };
}

describe('systems review draft helpers', () => {
  it('builds a deterministic draft from the current cockpit posture', () => {
    const draft = buildSystemsReviewDraft(buildDashboardFixture(), 'cron');

    expect(draft.actorType).toBe('cron');
    expect(draft.overallStatus).toBe('warning');
    expect(draft.focusArea).toMatch(/repair scorecard drift/i);
    expect(draft.topRisk).toMatch(/Weekly review rhythm is stale and needs immediate attention/i);
    expect(draft.hardeningCommitmentTitle).toBe('Repair scorecard drift');
    expect(draft.hardeningCommitmentSummary).toMatch(/confirm the blocker/i);
    expect(draft.linkedSloIds).toEqual(['freshness', 'journeys']);
    expect(draft.changeNotes).toMatch(/Commitment shepherd/i);
    expect(draft.changeNotes).toMatch(/Incident response/i);
    expect(draft.commitmentDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reuses incident retro follow-up evidence for the weekly commitment draft', () => {
    const data = buildDashboardFixture();
    data.latestCommitmentShepherd = null;
    data.automationFollowups = [
      {
        sourceKey: 'systems:incident-retro:incident:2026-04-04:koios-outage',
        triggerType: 'incident_retro_followup',
        severity: 'critical',
        status: 'open',
        title: "Turn Koios outage into this week's hardening commitment",
        summary: 'The permanent fix still needs to become named weekly operating work.',
        recommendedAction: 'Apply the suggested weekly commitment in the founder review.',
        actionHref: '/admin/systems#weekly-review',
        evidence: {
          incidentTitle: 'Koios outage',
          followUpOwner: 'Platform owner',
          commitmentTitle: 'Close the incident follow-up from Koios outage',
          commitmentSummary:
            'Systems affected: pipeline, freshness. Permanent fix to operationalize: Add stronger stale-data operator prompts.',
          linkedSloIds: ['freshness', 'availability'],
        },
        updatedAt: '2026-04-02T11:55:00.000Z',
      },
    ];

    const draft = buildSystemsReviewDraft(data, 'cron');

    expect(draft.focusArea).toMatch(/koios outage/i);
    expect(draft.hardeningCommitmentTitle).toBe('Close the incident follow-up from Koios outage');
    expect(draft.hardeningCommitmentSummary).toMatch(/permanent fix to operationalize/i);
    expect(draft.commitmentOwner).toBe('Platform owner');
    expect(draft.linkedSloIds).toEqual(['freshness', 'availability']);
    expect(draft.changeNotes).toMatch(/incident retro follow-up/i);
  });

  it('reuses performance baseline follow-up evidence for the weekly commitment draft', () => {
    const data = buildDashboardFixture();
    data.latestCommitmentShepherd = null;
    data.automationFollowups = [
      {
        sourceKey: 'systems:performance-baseline',
        triggerType: 'performance_baseline',
        severity: 'warning',
        status: 'open',
        title: 'Close the performance bottleneck from the latest baseline',
        summary: 'The DRep listing payload is still widening p95 under load.',
        recommendedAction:
          'Founder + agents owns the next move: Trim the payload and rerun the baseline.',
        actionHref: '/admin/systems#performance-baseline',
        evidence: {
          reason: 'bottleneck',
          latestBaselineDate: '2026-03-09',
          bottleneck: 'The DRep listing payload remains the slowest public path.',
          mitigationOwner: 'Platform owner',
        },
        updatedAt: '2026-04-02T11:55:00.000Z',
      },
    ];

    const draft = buildSystemsReviewDraft(data, 'cron');

    expect(draft.focusArea).toMatch(/performance bottleneck/i);
    expect(draft.hardeningCommitmentTitle).toMatch(/performance bottleneck/i);
    expect(draft.hardeningCommitmentSummary).toMatch(/rerun the baseline/i);
    expect(draft.commitmentOwner).toBe('Platform owner');
    expect(draft.changeNotes).toMatch(/Latest performance baseline/i);
    expect(draft.changeNotes).toMatch(/Performance baseline follow-up/i);
  });

  it('reads the latest valid draft from audit rows', () => {
    const state = parseLatestSystemsReviewDraft([
      {
        action: SYSTEMS_REVIEW_DRAFT_ACTION,
        payload: {
          actorType: 'manual',
          generatedAt: '2026-04-02T12:30:00.000Z',
          reviewDate: '2026-04-02',
          overallStatus: 'warning',
          focusArea: 'Protect freshness and review discipline',
          topRisk: 'Freshness and cadence are both drifting.',
          changeNotes: 'Freshness is drifting and the founder loop needs a refresh.',
          hardeningCommitmentTitle: 'Refresh the systems cadence',
          hardeningCommitmentSummary: 'Log a fresh review and reset the hardening loop.',
          commitmentOwner: 'Founder + agents',
          commitmentDueDate: '2026-04-03',
          linkedSloIds: ['freshness'],
        },
        created_at: '2026-04-02T12:30:00.000Z',
      },
      {
        action: SYSTEMS_REVIEW_DRAFT_ACTION,
        payload: { invalid: true },
        created_at: '2026-04-01T12:30:00.000Z',
      },
    ]);

    expect(state?.focusArea).toBe('Protect freshness and review discipline');
    expect(state?.linkedSloIds).toEqual(['freshness']);
  });

  it('builds review draft history entries for the automation cockpit', () => {
    const history = buildSystemsReviewDraftHistory([
      {
        action: SYSTEMS_REVIEW_DRAFT_ACTION,
        payload: {
          actorType: 'cron',
          generatedAt: '2026-04-02T12:30:00.000Z',
          reviewDate: '2026-04-02',
          overallStatus: 'warning',
          focusArea: 'Protect freshness and review discipline',
          topRisk: 'Freshness and cadence are both drifting.',
          changeNotes: 'Freshness is drifting and the founder loop needs a refresh.',
          hardeningCommitmentTitle: 'Refresh the systems cadence',
          hardeningCommitmentSummary: 'Log a fresh review and reset the hardening loop.',
          commitmentOwner: 'Founder + agents',
          commitmentDueDate: '2026-04-03',
          linkedSloIds: ['freshness'],
        },
        created_at: '2026-04-02T12:30:00.000Z',
      },
    ]);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      type: 'review_draft',
      statusLabel: 'Scheduled draft',
      tone: 'warning',
      actionHref: '/admin/systems#weekly-review',
    });
  });
});
