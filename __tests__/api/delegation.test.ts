import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockSelect = vi.fn();
const mockUpdate = vi.fn();

const mockValidateSession = vi.fn();
const mockGetRedis = vi.fn();
const mockLimit = vi.fn();

vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: (...args: unknown[]) => mockLimit(...args),
  }));

  Object.assign(Ratelimit, {
    slidingWindow: vi.fn().mockReturnValue('window'),
  });

  return { Ratelimit };
});

vi.mock('@/lib/supabaseAuth', () => ({
  validateSessionToken: (...args: unknown[]) => mockValidateSession(...args),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: () => ({
            limit: () => mockSelect(),
          }),
        };
      },
      update: (data: unknown) => {
        mockUpdate(data);
        return {
          eq: () => mockUpdate(),
        };
      },
    }),
  }),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
}));

import { GET, POST } from '@/app/api/drep-claim/route';

describe('GET /api/drep-claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when drepId is missing', async () => {
    const req = createRequest('/api/drep-claim');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns claimed: false when no user claims the DRep', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null });
    const req = createRequest('/api/drep-claim?drepId=drep1abc');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;
    expect(body.claimed).toBe(false);
  });

  it('returns claimed: true when a user has claimed the DRep', async () => {
    mockSelect.mockResolvedValue({ data: [{ wallet_address: 'addr1...' }], error: null });
    const req = createRequest('/api/drep-claim?drepId=drep1abc');
    const res = await GET(req);
    const body = (await parseJson(res)) as any;
    expect(body.claimed).toBe(true);
  });
});

describe('POST /api/drep-claim', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 4 });
  });

  it('returns 400 when fields are missing', async () => {
    const req = createRequest('/api/drep-claim', {
      method: 'POST',
      body: { sessionToken: 'tok' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 401 when session is invalid', async () => {
    mockValidateSession.mockResolvedValue(null);

    const req = createRequest('/api/drep-claim', {
      method: 'POST',
      body: { sessionToken: 'tok', drepId: 'drep1abc' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('claims a DRep successfully', async () => {
    mockValidateSession.mockResolvedValue({
      walletAddress: 'addr1test',
      exp: Date.now() + 100000,
      iat: Date.now(),
    });
    mockUpdate.mockResolvedValue({ error: null });

    const req = createRequest('/api/drep-claim', {
      method: 'POST',
      body: { sessionToken: 'valid-token', drepId: 'drep1abc' },
    });
    const res = await POST(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.claimed).toBe(true);
    expect(body.drepId).toBe('drep1abc');
  });
});
