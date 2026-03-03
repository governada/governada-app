import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockSelect = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/lib/supabaseAuth', () => ({
  parseSessionToken: vi.fn(),
  isSessionExpired: vi.fn(),
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

import { GET, POST } from '@/app/api/user/notification-prefs/route';
import { parseSessionToken, isSessionExpired } from '@/lib/supabaseAuth';

describe('GET /api/user/notification-prefs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth', async () => {
    vi.mocked(parseSessionToken).mockReturnValue(null);
    const req = createRequest('/api/user/notification-prefs');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns prefs for authenticated user', async () => {
    vi.mocked(parseSessionToken).mockReturnValue({
      walletAddress: 'addr1test',
      exp: Date.now() + 100000,
      iat: Date.now(),
    } as any);
    vi.mocked(isSessionExpired).mockReturnValue(false);
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
  });

  it('returns 401 without auth', async () => {
    vi.mocked(parseSessionToken).mockReturnValue(null);
    const req = createRequest('/api/user/notification-prefs', {
      method: 'POST',
      body: { channel: 'push', eventType: 'new_proposal', enabled: true },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    vi.mocked(parseSessionToken).mockReturnValue({
      walletAddress: 'addr1test',
      exp: Date.now() + 100000,
      iat: Date.now(),
    } as any);
    vi.mocked(isSessionExpired).mockReturnValue(false);

    const req = createRequest('/api/user/notification-prefs', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
      body: { channel: 'push' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('upserts a notification preference', async () => {
    vi.mocked(parseSessionToken).mockReturnValue({
      walletAddress: 'addr1test',
      exp: Date.now() + 100000,
      iat: Date.now(),
    } as any);
    vi.mocked(isSessionExpired).mockReturnValue(false);
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
