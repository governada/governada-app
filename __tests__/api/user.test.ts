import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockLimit = vi.fn();

const mockRequireAuth = vi.fn();

vi.mock('@/lib/supabaseAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: () => mockSelect(),
        };
      },
      upsert: (data: unknown, opts: unknown) => {
        mockUpsert(data, opts);
        return mockUpsert();
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

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow(max: number, window: string) {
      return { max, window };
    }

    limit(identifier: string) {
      return mockLimit(identifier);
    }
  },
}));

// Prevent rate limiter from hitting real Upstash Redis while still allowing
// the route wrapper to exercise the success path under test.
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({}),
}));

import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/user/notification-prefs/route';

describe('GET /api/user/notification-prefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ success: true, remaining: 19 });
  });

  it('returns 401 without auth', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const req = createRequest('/api/user/notification-prefs');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns prefs for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ wallet: 'addr1test' });
    mockSelect.mockResolvedValue({
      data: [{ channel: 'push', event_type: 'new_proposal', enabled: true }],
      error: null,
    });

    const req = createRequest('/api/user/notification-prefs', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    const res = await GET(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].channel).toBe('push');
  });
});

describe('POST /api/user/notification-prefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ success: true, remaining: 19 });
  });

  it('returns 401 without auth', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    );
    const req = createRequest('/api/user/notification-prefs', {
      method: 'POST',
      body: { channel: 'push', eventType: 'new_proposal', enabled: true },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    mockRequireAuth.mockResolvedValue({ wallet: 'addr1test' });

    const req = createRequest('/api/user/notification-prefs', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { channel: 'push' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('upserts a notification preference', async () => {
    mockRequireAuth.mockResolvedValue({ wallet: 'addr1test' });
    mockUpsert.mockResolvedValue({ error: null });

    const req = createRequest('/api/user/notification-prefs', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { channel: 'push', eventType: 'new_proposal', enabled: true },
    });
    const res = await POST(req);
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
