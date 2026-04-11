import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { mockAuditInsert, mockBaselineInsert, mockFrom } = vi.hoisted(() => ({
  mockAuditInsert: vi.fn(),
  mockBaselineInsert: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/adminAuth', () => ({
  isAdminWallet: () => true,
}));

import { logSystemsPerformanceBaseline } from '@/app/api/admin/systems/performance-baseline/route';

function createBaselinesChain() {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: mockBaselineInsert,
  };
}

function createAuditLogChain() {
  return {
    insert: mockAuditInsert,
  };
}

describe('systems performance baseline route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditInsert.mockResolvedValue({ error: null });
    mockBaselineInsert.mockResolvedValue({
      data: { id: '22222222-2222-4222-8222-222222222222' },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'systems_performance_baselines') return createBaselinesChain();
      if (table === 'admin_audit_log') return createAuditLogChain();
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('logs performance baselines into durable state and the admin audit trail', async () => {
    const response = await logSystemsPerformanceBaseline(
      createRequest('/api/admin/systems/performance-baseline', {
        method: 'POST',
        body: {
          baselineDate: '2026-04-06',
          environment: 'production',
          scenarioLabel: 'Minimum public read baseline',
          concurrencyProfile: '1 -> 10 -> 50 -> 100 VUs over 5 minutes',
          summary: 'Public read routes stayed near the target under load.',
          bottleneck: 'The `/api/dreps` payload is still the slowest path.',
          mitigationOwner: 'Founder + agents',
          nextStep: 'Trim the payload and rerun the baseline.',
          apiHealthP95Ms: 120,
          apiDrepsP95Ms: 610,
          apiV1DrepsP95Ms: 420,
          governanceHealthP95Ms: 340,
          errorRatePct: 0.7,
          artifactUrl: 'https://example.com/k6/report',
          notes: 'Manual rerun after caching hardening.',
        },
      }),
      { requestId: 'req-1', wallet: 'addr_test_admin' },
    );
    const body = (await parseJson(response)) as {
      id: string;
      baselineDate: string;
      overallStatus: string;
      scenarioLabel: string;
    };

    expect(response.status).toBe(201);
    expect(body.id).toBe('22222222-2222-4222-8222-222222222222');
    expect(body.baselineDate).toBe('2026-04-06');
    expect(body.overallStatus).toBe('warning');
    expect(body.scenarioLabel).toBe('Minimum public read baseline');
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'addr_test_admin',
        action: 'systems_performance_baseline_logged',
        target: expect.stringMatching(/^performance-baseline:2026-04-06:production:/),
        payload: expect.objectContaining({
          scenarioLabel: 'Minimum public read baseline',
          apiDrepsP95Ms: 610,
        }),
      }),
    );
  });
});
