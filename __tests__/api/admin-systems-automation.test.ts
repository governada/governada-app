import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { mockBuildSystemsDashboardData, mockSendFounderNotification, mockInsert, mockFrom } =
  vi.hoisted(() => ({
    mockBuildSystemsDashboardData: vi.fn(),
    mockSendFounderNotification: vi.fn(),
    mockInsert: vi.fn(),
    mockFrom: vi.fn(),
  }));

vi.mock('@/lib/admin/systemsDashboard', () => ({
  buildSystemsDashboardData: mockBuildSystemsDashboardData,
}));

vi.mock('@/lib/founderNotifications', () => ({
  sendFounderNotification: mockSendFounderNotification,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

import { runSystemsAutomationSweep } from '@/app/api/admin/systems/automation/route';

const CRON_SECRET = 'test-secret';

function createAuditLogChain() {
  return {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: mockInsert,
  };
}

describe('systems automation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    mockInsert.mockResolvedValue({ error: null });
    mockSendFounderNotification.mockResolvedValue({
      ok: true,
      channelCount: 0,
      channels: [],
      failureReason: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_audit_log') {
        return createAuditLogChain();
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('uses the full automation commitment scope for shepherding instead of the UI slice', async () => {
    mockBuildSystemsDashboardData.mockResolvedValue({
      overall: { status: 'good' },
      slos: [{ id: 'performance', status: 'good' }],
      reviewDiscipline: {
        status: 'good',
        headline: 'Weekly review rhythm is on track',
        currentValue: 'Reviewed today',
        target: 'A founder review recorded every 7 days',
        summary: 'The weekly loop is healthy.',
        lastReviewedAt: '2026-04-04T00:00:00.000Z',
        openCommitments: 7,
        overdueCommitments: 0,
      },
      incidentSummary: {
        status: 'good',
        headline: 'Incident and drill trail is current',
        currentValue: '0 open incidents / last drill 3d ago',
        target: 'Monthly drills with no unresolved high-severity incidents',
        summary: 'Recent incidents are resolved, and the drill cadence is fresh enough.',
        lastDrillAt: '2026-04-01',
        lastIncidentAt: null,
        openIncidentCount: 0,
        drillCount: 1,
        recentEntries: [],
      },
      incidentHistory: [],
      latestPerformanceBaseline: null,
      automationOpenCommitments: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          reviewId: 'review-old',
          title: 'Older blocked commitment',
          summary: 'This one should be selected by the sweep.',
          owner: 'Founder + agents',
          status: 'blocked',
          dueDate: '2026-03-20',
          linkedSloIds: ['change-safety'],
          createdAt: '2026-03-01T00:00:00.000Z',
          isOverdue: true,
          ageDays: 30,
        },
      ],
      openCommitments: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          reviewId: 'review-visible',
          title: 'Visible UI commitment',
          summary: 'This is in the six-card slice only.',
          owner: 'Founder + agents',
          status: 'planned',
          dueDate: '2026-04-10',
          linkedSloIds: ['performance'],
          createdAt: '2026-04-03T00:00:00.000Z',
          isOverdue: false,
          ageDays: 1,
        },
      ],
      actions: [],
    });

    const response = await runSystemsAutomationSweep(
      createRequest('/api/admin/systems/automation', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      { requestId: 'req-1' },
    );
    const body = (await parseJson(response)) as {
      commitmentShepherd: { commitmentId: string | null };
    };

    expect(response.status).toBe(200);
    expect(body.commitmentShepherd.commitmentId).toBe('11111111-1111-4111-8111-111111111111');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'systems_commitment_shepherd',
        target: '11111111-1111-4111-8111-111111111111',
      }),
    );
  });

  it('opens a drill cadence follow-up when no drill is logged yet', async () => {
    mockBuildSystemsDashboardData.mockResolvedValue({
      overall: { status: 'warning' },
      slos: [{ id: 'performance', status: 'warning' }],
      reviewDiscipline: {
        status: 'good',
        headline: 'Weekly review rhythm is on track',
        currentValue: 'Reviewed today',
        target: 'A founder review recorded every 7 days',
        summary: 'The weekly loop is healthy.',
        lastReviewedAt: '2026-04-04T00:00:00.000Z',
        openCommitments: 0,
        overdueCommitments: 0,
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
      latestPerformanceBaseline: null,
      automationOpenCommitments: [],
      openCommitments: [],
      actions: [],
    });

    const response = await runSystemsAutomationSweep(
      createRequest('/api/admin/systems/automation', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      { requestId: 'req-2' },
    );

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'systems_automation_followup_sync',
          target: 'systems:drill-cadence',
          payload: expect.objectContaining({
            sourceKey: 'systems:drill-cadence',
            triggerType: 'drill_cadence',
            actionHref: '/admin/systems#incident-log',
          }),
        }),
      ]),
    );
  });

  it('opens a performance baseline follow-up when the latest baseline is stale', async () => {
    mockBuildSystemsDashboardData.mockResolvedValue({
      overall: { status: 'warning' },
      slos: [{ id: 'performance', status: 'warning' }],
      reviewDiscipline: {
        status: 'good',
        headline: 'Weekly review rhythm is on track',
        currentValue: 'Reviewed today',
        target: 'A founder review recorded every 7 days',
        summary: 'The weekly loop is healthy.',
        lastReviewedAt: '2026-04-04T00:00:00.000Z',
        openCommitments: 0,
        overdueCommitments: 0,
      },
      incidentSummary: {
        status: 'good',
        headline: 'Incident and drill trail is current',
        currentValue: '0 open incidents / last drill 3d ago',
        target: 'Monthly drills with no unresolved high-severity incidents',
        summary: 'Recent incidents are resolved, and the drill cadence is fresh enough.',
        lastDrillAt: '2026-04-01',
        lastIncidentAt: null,
        openIncidentCount: 0,
        drillCount: 1,
        recentEntries: [],
      },
      incidentHistory: [],
      latestPerformanceBaseline: {
        actorType: 'manual',
        loggedAt: '2026-03-09T12:00:00.000Z',
        baselineDate: '2026-03-09',
        environment: 'production',
        scenarioLabel: 'Minimum public read baseline',
        concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
        overallStatus: 'warning',
        summary: 'Public read path is drifting above the ideal load target.',
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
      automationOpenCommitments: [],
      openCommitments: [],
      actions: [
        {
          id: 'record-baseline',
          title: 'Refresh the performance baseline',
          priority: 'P1',
          timeframe: 'this-week',
          summary: 'The latest minimum-load baseline is stale.',
          href: '/admin/systems#performance-baseline',
          automationReady: true,
        },
      ],
    });

    const response = await runSystemsAutomationSweep(
      createRequest('/api/admin/systems/automation', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      { requestId: 'req-3' },
    );

    expect(response.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'systems_automation_followup_sync',
          target: 'systems:performance-baseline',
          payload: expect.objectContaining({
            sourceKey: 'systems:performance-baseline',
            triggerType: 'performance_baseline',
            actionHref: '/admin/systems#performance-baseline',
          }),
        }),
      ]),
    );
  });
});
