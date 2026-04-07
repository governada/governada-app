import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockGetAllDReps = vi.fn();
const mockGetActualProposalCount = vi.fn();

vi.mock('@/lib/data', () => ({
  getAllDReps: () => mockGetAllDReps(),
  getActualProposalCount: () => mockGetActualProposalCount(),
}));

vi.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 100,
    remaining: 99,
    window: 60,
    reset: Date.now() + 60000,
  }),
  rateLimitHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/api/keys', () => ({
  validateApiKey: vi.fn().mockResolvedValue({ valid: false }),
  resolveApiKeyFromRequest: vi.fn().mockReturnValue(null),
}));

vi.mock('@/lib/api/logging', () => ({
  logApiRequest: vi.fn(),
  trackFirstRequest: vi.fn(),
}));

import { GET } from '@/app/api/v1/governance/health/route';

const makeDrep = (overrides = {}) => ({
  drepId: 'drep1abc',
  name: 'Test',
  drepScore: 75,
  effectiveParticipation: 70,
  rationaleRate: 60,
  reliabilityScore: 65,
  isActive: true,
  totalVotes: 40,
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('GET /api/v1/governance/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns governance health metrics', async () => {
    const dreps = [
      makeDrep({ drepScore: 90, isActive: true }),
      makeDrep({ drepId: 'drep2', drepScore: 60, isActive: true }),
      makeDrep({ drepId: 'drep3', drepScore: 40, isActive: false }),
    ];

    mockGetAllDReps.mockResolvedValue({
      dreps: dreps.filter((d) => d.isActive),
      allDReps: dreps,
      error: null,
    });
    mockGetActualProposalCount.mockResolvedValue(150);

    const req = createRequest('/api/v1/governance/health');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.data.total_registered_dreps).toBe(3);
    expect(body.data.active_dreps).toBe(2);
    expect(body.data.total_proposals).toBe(150);
    expect(body.data.score_distribution).toBeDefined();
    expect(body.data.score_distribution.strong).toBe(1); // 90
    expect(body.data.score_distribution.good).toBe(1); // 60
    expect(body.data.score_distribution.low).toBe(1); // 40
    expect(body.meta.api_version).toBe('v1');
  });

  it('handles empty DRep set gracefully', async () => {
    mockGetAllDReps.mockResolvedValue({ dreps: [], allDReps: [], error: null });
    mockGetActualProposalCount.mockResolvedValue(0);

    const req = createRequest('/api/v1/governance/health');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.data.total_registered_dreps).toBe(0);
    expect(body.data.average_score).toBe(0);
  });
});
