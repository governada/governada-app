import { describe, expect, it } from 'vitest';
import type { SystemsDashboardData } from '@/lib/admin/systems';
import {
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
    suggestedReviewDraft: null,
    automationOpenCommitments: [],
    openCommitments: [],
    reviewHistory: [],
    incidentHistory: [],
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
});
