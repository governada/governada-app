import { describe, expect, it } from 'vitest';
import {
  buildLatestSuccessfulEscalationBySource,
  buildSystemsAutomationSpecs,
  buildSystemsCommitmentShepherdRecord,
  buildSystemsCommitmentShepherdTarget,
  buildSystemsOperatorEscalationTargets,
  buildSystemsAutomationState,
  buildSystemsAutomationSummary,
  formatSystemsOperatorEscalationDigest,
  parseLatestSystemsCommitmentShepherd,
  parseLatestSystemsOperatorEscalation,
  summarizeSystemsAutomationRun,
  SYSTEMS_AUTOMATION_FOLLOWUP_ACTION,
  SYSTEMS_AUTOMATION_SWEEP_ACTION,
  SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
  SYSTEMS_OPERATOR_ESCALATION_ACTION,
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
      incidentSummary: {
        status: 'warning',
        headline: 'Failure drills have not started yet',
        currentValue: '0 open incidents / no drill yet',
        target: 'Monthly drills with no unresolved high-severity incidents',
        summary:
          'Real incidents may not happen on schedule, so drills are the only reliable way to practice detection and mitigation before launch pressure arrives.',
        lastDrillAt: null,
        lastIncidentAt: null,
        openIncidentCount: 0,
        drillCount: 0,
        recentEntries: [],
      },
      incidentHistory: [],
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
        'systems:drill-cadence',
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

  it('selects the most urgent blocked or overdue commitment for shepherding', () => {
    const target = buildSystemsCommitmentShepherdTarget([
      toSystemsCommitment({
        id: '8a6bb2b7-0dd9-4d67-9f59-20f5f2e31d54',
        review_id: '1d9cad5c-6ba5-4c9a-8f70-9835cff31568',
        title: 'Unblock the weekly review commitment',
        summary: 'Keep the operating loop honest.',
        owner: 'Founder + agents',
        status: 'blocked',
        due_date: '2026-03-25',
        linked_slo_ids: ['freshness'],
        created_at: '2026-03-20T00:00:00.000Z',
      }),
      toSystemsCommitment({
        id: '2be66a2b-0f24-4f03-9b2b-7c67d3646c31',
        review_id: '9d4fb0f3-9c82-4e7a-8ab5-9ef8bafcaa4d',
        title: 'Close the performance baseline gap',
        summary: 'Protect the slow-route bar.',
        owner: 'Founder + agents',
        status: 'planned',
        due_date: '2026-03-18',
        linked_slo_ids: ['performance'],
        created_at: '2026-03-15T00:00:00.000Z',
      }),
    ]);

    expect(target?.commitmentId).toBe('8a6bb2b7-0dd9-4d67-9f59-20f5f2e31d54');
    expect(target?.reason).toBe('blocked');
    expect(target?.actionHref).toBe(
      '/admin/systems#commitment-8a6bb2b7-0dd9-4d67-9f59-20f5f2e31d54',
    );
  });

  it('builds and parses the latest commitment shepherd record', () => {
    const target = buildSystemsCommitmentShepherdTarget([
      toSystemsCommitment({
        id: '8a6bb2b7-0dd9-4d67-9f59-20f5f2e31d54',
        review_id: '1d9cad5c-6ba5-4c9a-8f70-9835cff31568',
        title: 'Unblock the weekly review commitment',
        summary: 'Keep the operating loop honest.',
        owner: 'Founder + agents',
        status: 'blocked',
        due_date: '2026-03-25',
        linked_slo_ids: ['freshness'],
        created_at: '2026-03-20T00:00:00.000Z',
      }),
    ]);

    const record = buildSystemsCommitmentShepherdRecord(target, 'cron');

    expect(record.status).toBe('focus');
    expect(record.commitmentTitle).toBe('Unblock the weekly review commitment');

    expect(
      parseLatestSystemsCommitmentShepherd([
        {
          action: SYSTEMS_COMMITMENT_SHEPHERD_ACTION,
          payload: record,
          created_at: '2026-04-03T11:00:00.000Z',
        },
      ])?.commitmentId,
    ).toBe('8a6bb2b7-0dd9-4d67-9f59-20f5f2e31d54');
  });

  it('selects new and reminder-worthy critical followups for founder escalation', () => {
    const targets = buildSystemsOperatorEscalationTargets(
      [
        {
          sourceKey: 'systems:action:resolve-integrity-alerts',
          triggerType: 'systems_action',
          severity: 'critical',
          status: 'open',
          title: 'Resolve integrity alerts before more feature work',
          summary: 'Integrity has drifted out of the launch comfort zone.',
          recommendedAction: 'Resolve integrity now.',
          actionHref: '/admin/integrity',
          updatedAt: '2026-04-03T10:00:00.000Z',
        },
        {
          sourceKey: 'systems:review-discipline',
          triggerType: 'review_discipline',
          severity: 'critical',
          status: 'open',
          title: 'Refresh the weekly systems review now',
          summary: 'The review loop is stale.',
          recommendedAction: 'Log a fresh review.',
          actionHref: '/admin/systems#weekly-review',
          updatedAt: '2026-04-02T09:00:00.000Z',
        },
      ],
      new Map([['systems:review-discipline', '2026-04-02T09:30:00.000Z']]),
      new Date('2026-04-03T10:30:00.000Z'),
    );

    expect(targets).toHaveLength(2);
    expect(targets.map((target) => target.reason)).toEqual(
      expect.arrayContaining(['new', 'reminder']),
    );
  });

  it('reads the latest successful escalation state from audit rows', () => {
    const rows = [
      {
        action: SYSTEMS_OPERATOR_ESCALATION_ACTION,
        target: 'systems',
        payload: {
          actorType: 'cron',
          status: 'sent',
          title: 'Systems cockpit: 1 critical follow-up still open',
          details: 'Digest body',
          criticalCount: 1,
          followupSourceKeys: ['systems:review-discipline'],
          channelCount: 2,
          channels: ['discord', 'telegram'],
        },
        created_at: '2026-04-03T10:00:00.000Z',
      },
    ];

    expect(buildLatestSuccessfulEscalationBySource(rows).get('systems:review-discipline')).toBe(
      '2026-04-03T10:00:00.000Z',
    );
    expect(parseLatestSystemsOperatorEscalation(rows)?.channelCount).toBe(2);
  });

  it('formats a concise operator escalation digest with direct links', () => {
    const digest = formatSystemsOperatorEscalationDigest(
      [
        {
          sourceKey: 'systems:review-discipline',
          title: 'Refresh the weekly systems review now',
          summary: 'The review loop is stale.',
          actionHref: '/admin/systems#weekly-review',
          updatedAt: '2026-04-03T10:00:00.000Z',
          reason: 'new',
        },
      ],
      'https://governada.io',
    );

    expect(digest.title).toMatch(/1 critical follow-up/i);
    expect(digest.details).toMatch(/https:\/\/governada\.io\/admin\/systems#weekly-review/i);
    expect(digest.details).toMatch(/\[New\]/);
  });
});
