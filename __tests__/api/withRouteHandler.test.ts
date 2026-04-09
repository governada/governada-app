import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { createRequest, parseJson } from '../helpers';

const mockGetRedis = vi.fn();
const mockLimit = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockGetRedis(),
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

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

import { withRouteHandler } from '@/lib/api/withRouteHandler';

describe('withRouteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows public read requests when the shared rate limiter cannot initialize', async () => {
    mockGetRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRouteHandler(handler, { rateLimit: { max: 2, window: 60 } });

    const res = await wrapped(createRequest('/api/internal/test'));
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it('fails closed for mutating requests when the shared rate limiter cannot initialize', async () => {
    mockGetRedis.mockImplementation(() => {
      throw new Error('redis unavailable');
    });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRouteHandler(handler, { rateLimit: { max: 2, window: 60 } });

    const res = await wrapped(createRequest('/api/internal/test', { method: 'POST' }));
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(429);
    expect(body.error).toBe('Too many requests. Please try again later.');
    expect(handler).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it('allows the request when the shared rate limiter succeeds', async () => {
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 1 });

    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const wrapped = withRouteHandler(handler, { rateLimit: { max: 2, window: 60 } });

    const res = await wrapped(createRequest('/api/internal/test'));
    const body = (await parseJson(res)) as any;

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
