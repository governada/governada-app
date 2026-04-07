import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();

const mockRequireAuth = vi.fn();

vi.mock('@/lib/supabaseAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  validateSessionToken: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        mockSelect(table, ...args);
        return {
          eq: (...a: unknown[]) => {
            mockEq(...a);
            return {
              eq: (...b: unknown[]) => {
                mockEq(...b);
                return {
                  eq: (...c: unknown[]) => {
                    mockEq(...c);
                    return { single: () => mockSingle() };
                  },
                };
              },
            };
          },
        };
      },
      insert: (data: unknown) => {
        mockInsert(data);
        return Promise.resolve({ error: null });
      },
      update: (data: unknown) => {
        mockUpdate(data);
        return { eq: () => mockUpdate };
      },
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({}),
}));

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  }));

  Object.assign(Ratelimit, {
    slidingWindow: vi.fn().mockReturnValue('window'),
  });

  return { Ratelimit };
});

vi.mock('@/lib/api/response', () => ({
  generateRequestId: () => 'req_test',
  normalizeEndpoint: (p: string) => p.replace(/^\/api/, ''),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: () => 500,
}));

vi.mock('@/lib/matching/userProfile', () => ({
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
}));

import { NextResponse } from 'next/server';
import { POST } from '@/app/api/polls/vote/route';

describe('POST /api/polls/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ success: true, remaining: 9 });
  });

  it('returns 401 without auth token', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      body: { proposalTxHash: 'abc', proposalIndex: 0, vote: 'yes' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when proposalTxHash is missing', async () => {
    mockRequireAuth.mockResolvedValue({ wallet: 'addr1test' });
    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { proposalIndex: 0, vote: 'yes' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when vote is invalid', async () => {
    mockRequireAuth.mockResolvedValue({ wallet: 'addr1test' });
    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { proposalTxHash: 'abc', proposalIndex: 0, vote: 'maybe' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('inserts a new vote for first-time voter', async () => {
    mockRequireAuth.mockResolvedValue({ wallet: 'addr1test' });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });
    mockSelect.mockReturnValue({
      eq: () => ({
        eq: () => ({
          eq: () => ({ single: () => mockSingle() }),
        }),
      }),
    });

    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { proposalTxHash: 'tx123', proposalIndex: 0, vote: 'yes' },
    });
    const res = await POST(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.userVote).toBe('yes');
    expect(body.hasVoted).toBe(true);
  });
});
