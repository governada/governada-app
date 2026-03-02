import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();

vi.mock('@/lib/supabaseAuth', () => ({
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

import { POST } from '@/app/api/polls/vote/route';
import { validateSessionToken } from '@/lib/supabaseAuth';

describe('POST /api/polls/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    vi.mocked(validateSessionToken).mockResolvedValue(null);
    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      body: { proposalTxHash: 'abc', proposalIndex: 0, vote: 'yes' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when proposalTxHash is missing', async () => {
    vi.mocked(validateSessionToken).mockResolvedValue({ walletAddress: 'addr1...' } as any);
    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { proposalIndex: 0, vote: 'yes' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when vote is invalid', async () => {
    vi.mocked(validateSessionToken).mockResolvedValue({ walletAddress: 'addr1...' } as any);
    const req = createRequest('/api/polls/vote', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { proposalTxHash: 'abc', proposalIndex: 0, vote: 'maybe' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('inserts a new vote for first-time voter', async () => {
    vi.mocked(validateSessionToken).mockResolvedValue({ walletAddress: 'addr1test' } as any);
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
