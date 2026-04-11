import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const {
  mockBuildSystemsDashboardData,
  mockSendFounderNotification,
  mockAuditInsert,
  mockRunsInsertSingle,
  mockRunsUpdateEq,
  mockFollowupsOrder,
  mockFollowupsUpsert,
  mockEscalationsUpsert,
  mockEscalationsUpdateIn,
  mockFrom,
} = vi.hoisted(() => ({
  mockBuildSystemsDashboardData: vi.fn(),
  mockSendFounderNotification: vi.fn(),
  mockAuditInsert: vi.fn(),
  mockRunsInsertSingle: vi.fn(),
  mockRunsUpdateEq: vi.fn(),
  mockFollowupsOrder: vi.fn(),
  mockFollowupsUpsert: vi.fn(),
  mockEscalationsUpsert: vi.fn(),
  mockEscalationsUpdateIn: vi.fn(),
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
    insert: mockAuditInsert,
  };
}

function createRunsChain() {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: mockRunsInsertSingle,
    update: vi.fn().mockReturnThis(),
    eq: mockRunsUpdateEq,
  };
  return chain;
}

function createFollowupsChain() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: mockFollowupsOrder,
    upsert: mockFollowupsUpsert,
  };
  return chain;
}

function createEscalationsChain(runId = 'run-1') {
  let filterField: string | null = null;
  let filterValue: string | null = null;
  let mode: 'select' | 'update' = 'select';

  const chain = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn(() => {
      mode = 'update';
      return chain;
    }),
    eq: vi.fn((field: string, value: string) => {
      filterField = field;
      filterValue = value;
      return chain;
    }),
    order: vi.fn(() => {
      if (mode === 'update') {
        return Promise.resolve({ data: null, error: null });
      }

      if (filterField === 'status' && filterValue === 'sent') {
        return Promise.resolve({ data: [], error: null });
      }

      if (filterField === 'run_id' && filterValue === runId) {
        return Promise.resolve({ data: [], error: null });
      }

      throw new Error(`Unexpected escalation filter ${filterField}:${filterValue}`);
    }),
    upsert: mockEscalationsUpsert,
    in: mockEscalationsUpdateIn,
  };

  return chain;
}

describe('systems automation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    mockAuditInsert.mockResolvedValue({ error: null });
    mockRunsInsertSingle.mockResolvedValue({
      data: {
        id: 'run-1',
        run_key: 'systems:cron:2026-04-10',
        actor_type: 'cron',
        actor_wallet_address: 'system:systems-automation',
        request_id: 'req-1',
        status: 'running',
        summary: null,
        followup_count: 0,
        critical_count: 0,
        opened_count: 0,
        updated_count: 0,
        resolved_count: 0,
        started_at: '2026-04-10T00:00:00.000Z',
        completed_at: null,
      },
      error: null,
    });
    mockRunsUpdateEq.mockResolvedValue({ error: null });
    mockFollowupsOrder.mockResolvedValue({ data: [], error: null });
    mockFollowupsUpsert.mockResolvedValue({ error: null });
    mockEscalationsUpsert.mockResolvedValue({ error: null });
    mockEscalationsUpdateIn.mockResolvedValue({ error: null });
    mockSendFounderNotification.mockResolvedValue({
      ok: true,
      channelCount: 0,
      channels: [],
      failureReason: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admin_audit_log') return createAuditLogChain();
      if (table === 'systems_automation_runs') return createRunsChain();
      if (table === 'systems_automation_followups') return createFollowupsChain();
      if (table === 'systems_automation_escalations') return createEscalationsChain();
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
      trustSurfaceReviewSummary: {
        status: 'good',
        headline: 'No active degraded-state honesty review is required',
        currentValue: 'No active degraded-state review needed',
        target:
          'Review degraded-state trust surfaces within 7 days whenever availability, freshness, or correctness is not healthy',
        summary: 'No active degraded-state review is needed right now.',
        lastReviewedAt: null,
        daysSinceReview: null,
        reviewRequired: false,
        linkedSloIds: [],
      },
      latestTrustSurfaceReview: null,
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
    expect(
      mockAuditInsert.mock.calls.some(
        ([payload]) =>
          payload?.action === 'systems_commitment_shepherd' &&
          payload?.target === '11111111-1111-4111-8111-111111111111',
      ),
    ).toBe(true);
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
      trustSurfaceReviewSummary: {
        status: 'warning',
        headline: 'Degraded-state trust surfaces need review',
        currentValue: 'No durable trust-surface review logged',
        target:
          'Review degraded-state trust surfaces within 7 days whenever availability, freshness, or correctness is not healthy',
        summary: 'Freshness is degraded and no trust-surface review is logged yet.',
        lastReviewedAt: null,
        daysSinceReview: null,
        reviewRequired: true,
        linkedSloIds: ['freshness'],
      },
      latestTrustSurfaceReview: null,
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
    expect(mockFollowupsUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          source_key: 'systems:drill-cadence',
          trigger_type: 'drill_cadence',
          action_href: '/admin/systems/incidents?panel=create',
        }),
      ]),
      expect.anything(),
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
      trustSurfaceReviewSummary: {
        status: 'good',
        headline: 'No active degraded-state honesty review is required',
        currentValue: 'Last reviewed 2026-04-01',
        target:
          'Review degraded-state trust surfaces within 7 days whenever availability, freshness, or correctness is not healthy',
        summary: 'No active degraded-state review is needed right now.',
        lastReviewedAt: '2026-04-01T12:00:00.000Z',
        daysSinceReview: 1,
        reviewRequired: false,
        linkedSloIds: [],
      },
      latestTrustSurfaceReview: {
        actorType: 'manual',
        loggedAt: '2026-04-01T12:00:00.000Z',
        reviewDate: '2026-04-01',
        overallStatus: 'good',
        linkedSloIds: ['freshness'],
        reviewedSurfaces: ['Home shell'],
        summary: 'The stale-data state is explicit.',
        currentUserState: 'Users are clearly told when freshness is degraded.',
        honestyGap: 'No major honesty gap remains.',
        nextFix: 'Keep the copy aligned as surfaces evolve.',
        owner: 'Founder + agents',
        artifactUrl: null,
        notes: null,
        daysSinceReview: 1,
        isStale: false,
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
          href: '/admin/systems/evidence?panel=performance',
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
    expect(mockFollowupsUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          source_key: 'systems:performance-baseline',
          trigger_type: 'performance_baseline',
          action_href: '/admin/systems/evidence?panel=performance',
        }),
      ]),
      expect.anything(),
    );
  });

  it('opens a trust-surface follow-up when degraded-state review is missing', async () => {
    mockBuildSystemsDashboardData.mockResolvedValue({
      overall: { status: 'critical' },
      slos: [{ id: 'performance', status: 'good' }],
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
      latestPerformanceBaseline: null,
      trustSurfaceReviewSummary: {
        status: 'critical',
        headline: 'Degraded-state trust surfaces need review',
        currentValue: 'No durable trust-surface review logged',
        target:
          'Review degraded-state trust surfaces within 7 days whenever availability, freshness, or correctness is not healthy',
        summary: 'Freshness and correctness are degraded, but no trust-surface review is logged.',
        lastReviewedAt: null,
        daysSinceReview: null,
        reviewRequired: true,
        linkedSloIds: ['freshness', 'correctness'],
      },
      latestTrustSurfaceReview: null,
      automationOpenCommitments: [],
      openCommitments: [],
      actions: [],
    });

    const response = await runSystemsAutomationSweep(
      createRequest('/api/admin/systems/automation', {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
      { requestId: 'req-4' },
    );

    expect(response.status).toBe(200);
    expect(mockFollowupsUpsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          source_key: 'systems:trust-surface-review',
          trigger_type: 'trust_surface_review',
          action_href: '/admin/systems/evidence?panel=trust',
        }),
      ]),
      expect.anything(),
    );
  });
});
