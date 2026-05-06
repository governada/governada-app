import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POSTHOG_UPSTREAM_ORIGIN = 'https://us.i.posthog.com';
const RATE_LIMIT_MAX_TOKENS = 100;
const RATE_LIMIT_REFILL_MS = 60_000;
const REQUEST_HEADERS_TO_FORWARD = ['accept', 'content-type', 'content-encoding'] as const;
const RESPONSE_HEADERS_TO_FORWARD = ['content-type', 'content-encoding', 'cache-control'] as const;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type RateLimitBucket = {
  tokens: number;
  updatedAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function pruneOldBuckets(now: number): void {
  if (rateLimitBuckets.size <= 1_000) return;

  for (const [key, bucket] of rateLimitBuckets) {
    if (now - bucket.updatedAt > RATE_LIMIT_REFILL_MS * 2) {
      rateLimitBuckets.delete(key);
    }
  }
}

function consumeRateLimitToken(request: NextRequest): boolean {
  const now = Date.now();
  const key = hashIp(getClientIp(request));
  const bucket = rateLimitBuckets.get(key) ?? {
    tokens: RATE_LIMIT_MAX_TOKENS,
    updatedAt: now,
  };
  const elapsedMs = Math.max(0, now - bucket.updatedAt);
  const refillTokens = (elapsedMs / RATE_LIMIT_REFILL_MS) * RATE_LIMIT_MAX_TOKENS;

  bucket.tokens = Math.min(RATE_LIMIT_MAX_TOKENS, bucket.tokens + refillTokens);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    rateLimitBuckets.set(key, bucket);
    pruneOldBuckets(now);
    return false;
  }

  bucket.tokens -= 1;
  rateLimitBuckets.set(key, bucket);
  pruneOldBuckets(now);
  return true;
}

function buildForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  for (const header of REQUEST_HEADERS_TO_FORWARD) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  return headers;
}

function buildResponseHeaders(upstreamResponse: Response): Headers {
  const headers = new Headers();

  for (const header of RESPONSE_HEADERS_TO_FORWARD) {
    const value = upstreamResponse.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  return headers;
}

function buildUpstreamUrl(request: NextRequest): URL {
  const prefix = '/api/ph/';
  const pathname = request.nextUrl.pathname;
  const upstreamPath = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname.replace(/^\/api\/ph\/?/u, '');
  const upstreamUrl = new URL(`${POSTHOG_UPSTREAM_ORIGIN}/${upstreamPath}`);

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
  if (!consumeRateLimitToken(request)) {
    return new NextResponse('Too many requests', {
      status: 429,
      headers: { 'cache-control': 'no-store' },
    });
  }

  const upstreamResponse = await fetch(buildUpstreamUrl(request), {
    method: request.method,
    headers: buildForwardHeaders(request),
    body: await readForwardBody(request),
  });

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
  rateLimitBuckets.clear();
}
