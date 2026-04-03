import { describe, expect, it } from 'vitest';
import {
  buildSystemsAutomationSpecs,
  buildSystemsAutomationState,
  buildSystemsAutomationSummary,
  summarizeSystemsAutomationRun,
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
} from '@/lib/admin/systemsAutomation';
import { toSystemsCommitment } from '@/lib/admin/systemsReview';

describe('systems automation helpers', () => {
  it('creates specs from stale reviews, overdue commitments, and critical actions', () => {
    const overdueCommitment = toSystemsCommitment({
      id: '4375fe7d-f712-48d5-ac2a-c17b62d8d7ce',
      review_id: '1d9cad5c-6ba5-4c9a-8f70-9835cff31568',
      title: 'Tighten public performance baseline',
      summary: 'Protect the launch bar for slow APIs.',
      owner: 'Founder + agents',
      status: 'planned',
      due_date: '2026-03-25',
      linked_slo_ids: ['performance'],
      created_at: '2026-03-20T00:00:00.000Z',
    });

    const specs = buildSystemsAutomationSpecs({
      reviewDiscipline: {
        status: 'warning',
        headline: 'Weekly review rhythm is slipping',
        currentValue: 'Last reviewed 10 days ago',
        target: 'A founder review recorded every 7 days',
        summary: 'Refresh the scorecard before the loop loses credibility.',
        lastReviewedAt: '2026-03-23T12:00:00.000Z',
        openCommitments: 2,
        overdueCommitments: 1,
      },
      openCommitments: [overdueCommitment],
      actions: [
        {
          id: 'resolve-integrity-alerts',
          title: 'Resolve integrity alerts before more feature work',
          priority: 'P0',
          timeframe: 'now',
          summary: 'Integrity has drifted out of the launch comfort zone.',
          href: '/admin/integrity',
          automationReady: true,
        },
      ],
    });

    expect(specs.map((spec) => spec.sourceKey)).toEqual(
      expect.arrayContaining([
        'systems:review-discipline',
        'systems:commitment:4375fe7d-f712-48d5-ac2a-c17b62d8d7ce',
        'systems:action:resolve-integrity-alerts',
      ]),
    );
  });

  it('builds current followups and latest sweep state from audit rows', () => {
    const state = buildSystemsAutomationState([
      {
        action: SYSTEMS_AUTOMATION_SWEEP_ACTION,
        target: 'systems',
        payload: {
          actorType: 'manual',
          status: 'warning',
          summary: 'Sweep surfaced 1 warning-level follow-up.',
          followupCount: 1,
          criticalCount: 0,
          openedCount: 1,
          updatedCount: 0,
          resolvedCount: 0,
        },
        created_at: '2026-04-02T10:05:00.000Z',
      },
      {
        action: SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
        target: 'systems:review-discipline',
        payload: {
          sourceKey: 'systems:review-discipline',
          triggerType: 'review_discipline',
          severity: 'warning',
          status: 'open',
          title: 'Refresh the weekly systems review soon',
          summary: 'Refresh the scorecard before the loop loses credibility.',
          recommendedAction: 'Open the weekly operating loop and log a fresh review.',
          actionHref: '/admin/systems#weekly-review',
          evidence: { overdueCommitments: 1 },
        },
        created_at: '2026-04-02T10:04:00.000Z',
      },
    ]);

    expect(state.openFollowups).toHaveLength(1);
    expect(state.openFollowups[0]?.sourceKey).toBe('systems:review-discipline');
    expect(state.latestRun?.status).toBe('warning');
  });

  it('marks automation summary bootstrap when no sweep has run yet', () => {
    const summary = buildSystemsAutomationSummary([], null);

    expect(summary.status).toBe('bootstrap');
    expect(summary.headline).toMatch(/has not run yet/i);
  });

  it('summarizes a clean sweep as healthy', () => {
    const run = summarizeSystemsAutomationRun([]);

    expect(run.status).toBe('good');
    expect(run.summary).toMatch(/no unresolved systems follow-ups/i);
  });
});
