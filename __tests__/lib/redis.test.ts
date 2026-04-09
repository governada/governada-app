import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('cached', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.unmock('@upstash/redis');
  });

  it('falls back to the fetcher when Redis is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { cached } = await import('@/lib/redis');
    const fetcher = vi.fn().mockResolvedValue({ ok: true });

    await expect(cached('cache:key', 60, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns the cached value when Redis has a hit', async () => {
    const mockRedis = {
      get: vi.fn().mockResolvedValue({ ok: true }),
      set: vi.fn(),
    };

    vi.doMock('@upstash/redis', () => ({
      Redis: vi.fn().mockImplementation(() => mockRedis),
    }));

    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';

    const { cached } = await import('@/lib/redis');
    const fetcher = vi.fn().mockResolvedValue({ ok: false });

    await expect(cached('cache:key', 60, fetcher)).resolves.toEqual({ ok: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mockRedis.get).toHaveBeenCalledWith('cache:key');
  });
});
