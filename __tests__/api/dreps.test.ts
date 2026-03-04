import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockGetAllDReps = vi.fn();
const mockGetDRepById = vi.fn();

vi.mock('@/lib/data', () => ({
  getAllDReps: () => mockGetAllDReps(),
  getDRepById: (id: string) => mockGetDRepById(id),
}));

import { GET } from '@/app/api/dreps/route';

const fakeDrep = {
  drepId: 'drep1abc123',
  name: 'Alice',
  ticker: null,
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

describe('GET /api/dreps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns dreps list on success', async () => {
    mockGetAllDReps.mockResolvedValue({
      dreps: [fakeDrep],
      allDReps: [fakeDrep],
      error: null,
      totalAvailable: 1,
    });

    const req = createRequest('/api/dreps');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.dreps).toHaveLength(1);
    expect(body.dreps[0].drepId).toBe('drep1abc123');
    expect(body.totalAvailable).toBe(1);
  });

  it('returns existence check when id and check=1 params provided', async () => {
    mockGetDRepById.mockResolvedValue(fakeDrep);

    const req = createRequest('/api/dreps?id=drep1abc123&check=1');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
  });

  it('returns exists=false for unknown drep', async () => {
    mockGetDRepById.mockResolvedValue(null);

    const req = createRequest('/api/dreps?id=drep1unknown&check=1');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(body.exists).toBe(false);
  });

  it('returns 500 on error', async () => {
    mockGetAllDReps.mockRejectedValue(new Error('Data fetch failed'));

    const req = createRequest('/api/dreps');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
