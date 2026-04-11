import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const { mockAuditInsert, mockReviewInsert, mockFrom } = vi.hoisted(() => ({
  mockAuditInsert: vi.fn(),
  mockReviewInsert: vi.fn(),
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

import { logSystemsTrustSurfaceReview } from '@/app/api/admin/systems/trust-surface-review/route';

function createTrustReviewsChain() {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: mockReviewInsert,
  };
}

function createAuditLogChain() {
  return {
    insert: mockAuditInsert,
  };
}

describe('systems trust-surface review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditInsert.mockResolvedValue({ error: null });
    mockReviewInsert.mockResolvedValue({
      data: { id: '33333333-3333-4333-8333-333333333333' },
      error: null,
    });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'systems_trust_surface_reviews') return createTrustReviewsChain();
      if (table === 'admin_audit_log') return createAuditLogChain();
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('logs trust-surface reviews into durable state and the admin audit trail', async () => {
    const response = await logSystemsTrustSurfaceReview(
      createRequest('/api/admin/systems/trust-surface-review', {
        method: 'POST',
        body: {
          reviewDate: '2026-04-06',
          overallStatus: 'warning',
          linkedSloIds: ['freshness', 'correctness'],
          reviewedSurfaces: ['Home shell', 'Proposal detail'],
          summary: 'Public surfaces are partly honest during freshness drift.',
          currentUserState: 'Users can still read data, but the degraded state is too subtle.',
          honestyGap: 'Freshness drift is easy to miss on proposal detail.',
          nextFix: 'Add explicit stale-data copy on the affected surfaces.',
          owner: 'Founder + agents',
          artifactUrl: 'https://example.com/review',
          notes: 'Manual degraded-state walkthrough.',
        },
      }),
      { requestId: 'req-1', wallet: 'addr_test_admin' },
    );
    const body = (await parseJson(response)) as {
      id: string;
      reviewDate: string;
      overallStatus: string;
      reviewedSurfaces: string[];
    };

    expect(response.status).toBe(201);
    expect(body.id).toBe('33333333-3333-4333-8333-333333333333');
    expect(body.reviewDate).toBe('2026-04-06');
    expect(body.overallStatus).toBe('warning');
    expect(body.reviewedSurfaces).toEqual(['Home shell', 'Proposal detail']);
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'addr_test_admin',
        action: 'systems_trust_surface_review_logged',
        target: expect.stringMatching(/^trust-surface-review:2026-04-06:warning:/),
        payload: expect.objectContaining({
          linkedSloIds: ['freshness', 'correctness'],
          reviewedSurfaces: ['Home shell', 'Proposal detail'],
        }),
      }),
    );
  });
});
