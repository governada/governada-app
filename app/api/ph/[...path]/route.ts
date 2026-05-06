import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_POSTHOG_UPSTREAM_ORIGIN = 'https://us.i.posthog.com';
const RATE_LIMIT_MAX_TOKENS = 100;
const RATE_LIMIT_WINDOW = '60 s';
const POSTHOG_PROXY_TIMEOUT_MS = 10_000;
const REQUEST_HEADERS_TO_FORWARD = ['accept', 'content-type', 'content-encoding'] as const;
const RESPONSE_HEADERS_TO_FORWARD = ['content-type', 'content-encoding', 'cache-control'] as const;
const DECODED_RESPONSE_ENCODINGS = new Set(['br', 'deflate', 'gzip', 'x-gzip', 'zstd']);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

let postHogProxyLimiter: import('@upstash/ratelimit').Ratelimit | null = null;

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function getClientIp(request: NextRequest): string | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim();

  return ip || null;
}

function getRateLimitIdentifier(request: NextRequest): string {
  const ip = getClientIp(request);
  if (ip) return `ip:${hashIp(ip)}`;

  return `fallback:${hashIp(
    [
      request.headers.get('host') ?? request.nextUrl.host,
      request.headers.get('user-agent') ?? 'unknown-agent',
    ].join('|'),
  )}`;
}

async function getPostHogProxyLimiter(): Promise<import('@upstash/ratelimit').Ratelimit> {
  if (postHogProxyLimiter) return postHogProxyLimiter;

  const [{ getRedis }, { Ratelimit }] = await Promise.all([
    import('@/lib/redis'),
    import('@upstash/ratelimit'),
  ]);

  postHogProxyLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_TOKENS, RATE_LIMIT_WINDOW),
    prefix: 'rl:posthog-proxy',
  });
  return postHogProxyLimiter;
}

async function isRateLimitAllowed(request: NextRequest): Promise<boolean> {
  try {
    const limiter = await getPostHogProxyLimiter();
    const result = await limiter.limit(getRateLimitIdentifier(request));
    return result.success;
  } catch (error) {
    logger.error('PostHog proxy rate limit check failed', {
      context: 'api/ph',
      error,
    });
    return false;
  }
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  for (const header of REQUEST_HEADERS_TO_FORWARD) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  headers.set('accept-encoding', 'identity');
  return headers;
}

function isDecodedResponseEncoding(value: string): boolean {
  return value
    .split(',')
    .map((encoding) => encoding.trim().toLowerCase())
    .some((encoding) => DECODED_RESPONSE_ENCODINGS.has(encoding));
}

function buildResponseHeaders(upstreamResponse: Response): Headers {
  const headers = new Headers();

  for (const header of RESPONSE_HEADERS_TO_FORWARD) {
    const value = upstreamResponse.headers.get(header);
    if (value) {
      // Node fetch decodes compressed response bodies but leaves the original
      // content-encoding header visible. Do not advertise decoded bytes as gzip.
      if (header === 'content-encoding' && isDecodedResponseEncoding(value)) {
        continue;
      }

      headers.set(header, value);
    }
  }

  return headers;
}

export function resolvePostHogUpstreamOrigin(
  configuredHost = process.env.NEXT_PUBLIC_POSTHOG_HOST,
): string {
  if (!configuredHost) return DEFAULT_POSTHOG_UPSTREAM_ORIGIN;

  try {
    const url = new URL(configuredHost);

    if (url.hostname.endsWith('.i.posthog.com')) {
      return url.origin;
    }

    if (url.hostname.endsWith('.posthog.com')) {
      url.hostname = url.hostname.replace(/\.posthog\.com$/u, '.i.posthog.com');
      return url.origin;
    }

    return url.origin;
  } catch {
    return DEFAULT_POSTHOG_UPSTREAM_ORIGIN;
  }
}

function buildUpstreamUrl(request: NextRequest): URL {
  const prefix = '/api/ph/';
  const pathname = request.nextUrl.pathname;
  const upstreamPath = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname.replace(/^\/api\/ph\/?/u, '');
  const upstreamUrl = new URL(`${resolvePostHogUpstreamOrigin()}/${upstreamPath}`);

  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl;
}

async function readForwardBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return undefined;
  }

  const body = await request.arrayBuffer();
  return body.byteLength > 0 ? body : undefined;
}

async function proxyPostHog(request: NextRequest, _context: RouteContext): Promise<NextResponse> {
  if (!(await isRateLimitAllowed(request))) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'cache-control': 'no-store' },
    });
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(buildUpstreamUrl(request), {
      method: request.method,
      headers: buildForwardHeaders(request),
      body: await readForwardBody(request),
      signal: AbortSignal.timeout(POSTHOG_PROXY_TIMEOUT_MS),
    });
  } catch (error) {
    logger.error('PostHog proxy upstream request failed', {
      context: 'api/ph',
      method: request.method,
      path: request.nextUrl.pathname,
      error,
    });
    return new NextResponse('PostHog upstream unavailable', {
      status: 502,
      headers: { 'cache-control': 'no-store' },
    });
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildResponseHeaders(upstreamResponse),
  });
}

export const GET = proxyPostHog;
export const POST = proxyPostHog;
export const PUT = proxyPostHog;
export const PATCH = proxyPostHog;
export const DELETE = proxyPostHog;
export const OPTIONS = proxyPostHog;
export const HEAD = proxyPostHog;

export function resetPostHogProxyRateLimitForTests(): void {
  postHogProxyLimiter = null;
}
