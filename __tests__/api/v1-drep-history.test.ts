import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockGetDRepById = vi.fn();
const mockGetScoreHistory = vi.fn();
const mockValidateApiKey = vi.fn();
const mockResolveApiKeyFromRequest = vi.fn();

vi.mock('@/lib/data', () => ({
  getDRepById: (id: string) => mockGetDRepById(id),
  getScoreHistory: (id: string) => mockGetScoreHistory(id),
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
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  resolveApiKeyFromRequest: (...args: unknown[]) => mockResolveApiKeyFromRequest(...args),
  getTierDefaults: vi.fn().mockReturnValue({ rateLimit: 100, rateWindow: 'hour' }),
}));

vi.mock('@/lib/api/logging', () => ({
  logApiRequest: vi.fn(),
  trackFirstRequest: vi.fn(),
}));

import { GET } from '@/app/api/v1/dreps/[drepId]/history/route';

const fakeDrep = {
  drepId: 'drep1abc123',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('GET /api/v1/dreps/[drepId]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveApiKeyFromRequest.mockReturnValue(null);
    mockGetDRepById.mockResolvedValue(fakeDrep);
    mockGetScoreHistory.mockResolvedValue([
      {
        date: '2026-04-01',
        score: 82,
        effectiveParticipation: 75,
        rationaleRate: 60,
        reliabilityScore: 70,
        profileCompleteness: 85,
      },
    ]);
  });

  it('rejects public-tier API keys for pro-tier routes', async () => {
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      key: {
        id: 'key_public',
        keyPrefix: 'ds_live_public',
        tier: 'public',
        rateLimit: 100,
        rateWindow: 'hour',
      },
    });

    const req = createRequest('/api/v1/dreps/drep1abc123/history', {
      headers: { Authorization: 'Bearer ds_live_public_key' },
    });
    const res = await GET(req, { params: Promise.resolve({ drepId: 'drep1abc123' }) });
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('tier_insufficient');
  });

  it('allows pro-tier API keys for pro-tier routes', async () => {
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      key: {
        id: 'key_pro',
        keyPrefix: 'ds_live_pro',
        tier: 'pro',
        rateLimit: 10000,
        rateWindow: 'day',
      },
    });

    const req = createRequest('/api/v1/dreps/drep1abc123/history', {
      headers: { Authorization: 'Bearer ds_live_pro_key' },
    });
    const res = await GET(req, { params: Promise.resolve({ drepId: 'drep1abc123' }) });
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('accepts X-API-Key as an alternative transport for pro-tier routes', async () => {
    mockResolveApiKeyFromRequest.mockReturnValue('ds_live_pro_key');
    mockValidateApiKey.mockResolvedValue({
      valid: true,
      key: {
        id: 'key_pro',
        keyPrefix: 'ds_live_pro',
        tier: 'pro',
        rateLimit: 10000,
        rateWindow: 'day',
      },
    });

    const req = createRequest('/api/v1/dreps/drep1abc123/history', {
      headers: { 'X-API-Key': 'ds_live_pro_key' },
    });
    const res = await GET(req, { params: Promise.resolve({ drepId: 'drep1abc123' }) });
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
