import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockGetAllDReps = vi.fn();

vi.mock('@/lib/data', () => ({
  getAllDReps: () => mockGetAllDReps(),
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

import { GET } from '@/app/api/v1/dreps/route';

const fakeDrep = {
  drepId: 'drep1abc123',
  name: 'Alice',
  ticker: 'ALC',
  handle: null,
  drepScore: 82,
  effectiveParticipation: 75,
  rationaleRate: 60,
  reliabilityScore: 70,
  profileCompleteness: 85,
  votingPowerLovelace: '5000000000',
  delegatorCount: 12,
  isActive: true,
  lastVoteTime: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  totalVotes: 50,
};

const activeButUndocumentedDrep = {
  ...fakeDrep,
  drepId: 'drep1undocumented',
  name: 'Bob',
  ticker: 'BOB',
  drepScore: 64,
};

const inactiveDrep = {
  ...fakeDrep,
  drepId: 'drep1inactive',
  name: 'Carol',
  ticker: 'CRL',
  isActive: false,
  drepScore: 30,
};

describe('GET /api/v1/dreps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllDReps.mockResolvedValue({
      dreps: [fakeDrep],
      allDReps: [fakeDrep, activeButUndocumentedDrep, inactiveDrep],
      error: null,
      totalAvailable: 3,
    });
  });

  it('returns paginated active dreps with meta envelope by default', async () => {
    const req = createRequest('/api/v1/dreps');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.meta).toBeDefined();
    expect(body.meta.api_version).toBe('v1');
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBe(2); // active_only defaults true
    expect(body.data.every((d: any) => d.is_active === true)).toBe(true);
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=600',
    );
  });

  it('includes inactive dreps when active_only=false', async () => {
    const req = createRequest('/api/v1/dreps?active_only=false');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(body.pagination.total).toBe(3);
  });

  it('filters by activity status, not documentation completeness', async () => {
    const req = createRequest('/api/v1/dreps');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(body.data.map((d: any) => d.drep_id)).toContain('drep1undocumented');
    expect(body.data.map((d: any) => d.drep_id)).not.toContain('drep1inactive');
  });

  it('supports search parameter', async () => {
    const req = createRequest('/api/v1/dreps?search=alice');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].name).toBe('Alice');
  });

  it('rejects invalid sort field', async () => {
    const req = createRequest('/api/v1/dreps?sort=invalid');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('rejects invalid order', async () => {
    const req = createRequest('/api/v1/dreps?order=sideways');
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('respects limit and offset', async () => {
    const testDReps = Array(5)
      .fill(null)
      .map((_, i) => ({
        ...fakeDrep,
        drepId: `drep1test${i}`,
        drepScore: 80 - i,
      }));

    mockGetAllDReps.mockResolvedValue({
      dreps: testDReps,
      allDReps: testDReps,
      error: null,
      totalAvailable: 5,
    });

    const req = createRequest('/api/v1/dreps?limit=2&offset=1');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(body.data).toHaveLength(2);
    expect(body.pagination.offset).toBe(1);
    expect(body.pagination.has_more).toBe(true);
  });
});
