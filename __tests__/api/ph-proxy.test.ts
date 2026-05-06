import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRedis = vi.fn();
const mockLimit = vi.fn();
const mockLoggerError = vi.fn();

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
  },
}));

import {
  GET,
  POST,
  dynamic,
  resetPostHogProxyRateLimitForTests,
  resolvePostHogUpstreamOrigin,
  runtime,
} from '@/app/api/ph/[...path]/route';

function createProxyRequest(
  path: string,
  {
    method = 'POST',
    body,
    headers = {},
  }: {
    method?: string;
    body?: BodyInit;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: new Headers(headers),
    body,
  });
}

function routeContext(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('/api/ph/[...path] PostHog proxy', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mockGetRedis.mockReturnValue({});
    mockLimit.mockResolvedValue({ success: true, remaining: 99 });
    resetPostHogProxyRateLimitForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is explicitly dynamic and uses the Node.js runtime', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(runtime).toBe('nodejs');
  });

  it('forwards compressed SDK payload bytes and safe headers to PostHog', async () => {
    const compressedBody = new Uint8Array([31, 139, 8, 0, 111, 112, 97, 113, 117, 101]);

    fetchMock.mockResolvedValueOnce(
      new Response('accepted', {
        status: 202,
        statusText: 'Accepted',
        headers: {
          'content-type': 'text/plain',
          'content-encoding': 'gzip',
          'cache-control': 'no-store',
          'x-posthog-private': 'drop-me',
        },
      }),
    );

    const response = await POST(
      createProxyRequest('/api/ph/e/?compression=gzip-js', {
        method: 'POST',
        body: compressedBody,
        headers: {
          accept: '*/*',
          authorization: 'Bearer should-not-forward',
          cookie: 'governada_session=should-not-forward',
          'content-encoding': 'gzip',
          'content-type': 'application/json',
          host: 'governada.io',
          'x-forwarded-for': '203.0.113.10',
        },
      }),
      routeContext(['e']),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockLimit).toHaveBeenCalledWith(expect.stringMatching(/^ip:/u));

    const [upstreamUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(upstreamUrl)).toBe('https://us.i.posthog.com/e/?compression=gzip-js');
    expect(init.method).toBe('POST');
    expect([...new Uint8Array(init.body as ArrayBuffer)]).toEqual([...compressedBody]);

    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get('accept')).toBe('*/*');
    expect(forwardedHeaders.get('accept-encoding')).toBe('identity');
    expect(forwardedHeaders.get('content-encoding')).toBe('gzip');
    expect(forwardedHeaders.get('content-type')).toBe('application/json');
    expect(forwardedHeaders.has('authorization')).toBe(false);
    expect(forwardedHeaders.has('cookie')).toBe(false);
    expect(forwardedHeaders.has('host')).toBe(false);

    expect(response.status).toBe(202);
    expect(response.headers.get('content-type')).toBe('text/plain');
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-posthog-private')).toBeNull();
    expect(await response.text()).toBe('accepted');
  });

  it('passes GET requests and streamed upstream responses through without a body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ featureFlags: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET(
      createProxyRequest('/api/ph/decide/?v=3', {
        method: 'GET',
        headers: {
          accept: 'application/json',
          cookie: 'governada_session=should-not-forward',
          'x-forwarded-for': '203.0.113.11',
        },
      }),
      routeContext(['decide']),
    );

    const [upstreamUrl, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const forwardedHeaders = init.headers as Headers;

    expect(String(upstreamUrl)).toBe('https://us.i.posthog.com/decide/?v=3');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(forwardedHeaders.get('accept')).toBe('application/json');
    expect(forwardedHeaders.has('cookie')).toBe(false);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ featureFlags: {} });
  });

  it('derives the upstream ingest origin from the configured PostHog host', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.posthog.com');
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    await POST(
      createProxyRequest('/api/ph/e/', {
        method: 'POST',
        body: '{}',
        headers: { 'x-forwarded-for': '198.51.100.22' },
      }),
      routeContext(['e']),
    );

    const [upstreamUrl] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(upstreamUrl)).toBe('https://eu.i.posthog.com/e/');
    expect(resolvePostHogUpstreamOrigin('https://eu.i.posthog.com')).toBe(
      'https://eu.i.posthog.com',
    );
  });

  it('bounds abuse with the shared Redis-backed limiter before hitting upstream', async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const blocked = await POST(
      createProxyRequest('/api/ph/e/', {
        method: 'POST',
        body: '{}',
        headers: { 'x-forwarded-for': '198.51.100.22' },
      }),
      routeContext(['e']),
    );

    expect(blocked.status).toBe(429);
    expect(await blocked.text()).toBe('Too many requests');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a fallback limiter key when proxy IP headers are missing', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const response = await POST(
      createProxyRequest('/api/ph/e/', {
        method: 'POST',
        body: '{}',
        headers: { 'user-agent': 'vitest' },
      }),
      routeContext(['e']),
    );

    expect(response.status).toBe(200);
    expect(mockLimit).toHaveBeenCalledWith(expect.stringMatching(/^fallback:/u));
  });

  it('returns 502 and logs when the upstream request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('upstream unavailable'));

    const response = await POST(
      createProxyRequest('/api/ph/e/', {
        method: 'POST',
        body: '{}',
        headers: { 'x-forwarded-for': '198.51.100.23' },
      }),
      routeContext(['e']),
    );

    expect(response.status).toBe(502);
    expect(await response.text()).toBe('PostHog upstream unavailable');
    expect(mockLoggerError).toHaveBeenCalledWith(
      'PostHog proxy upstream request failed',
      expect.objectContaining({ context: 'api/ph', method: 'POST', path: '/api/ph/e/' }),
    );
  });
});
