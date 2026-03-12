/**
 * Next.js Middleware
 * - Query-param redirects for old /discover?tab= routes
 * - Auth gate for protected routes (workspace, you)
 * - CORS for /api/v1/* routes
 * Auth and rate limiting for API routes are handled in lib/api/handler.ts.
 */

import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Expose-Headers':
    'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
  'Access-Control-Max-Age': '86400',
};

/** Old /discover?tab= → new /governance/* routes */
const DISCOVER_TAB_MAP: Record<string, string> = {
  dreps: '/governance/representatives',
  spos: '/governance/pools',
  proposals: '/governance/proposals',
  committee: '/governance/committee',
  rankings: '/governance/representatives?view=rankings',
};

const AUTH_REQUIRED_PATHS = ['/workspace', '/you'];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Query-param redirects ─────────────────────────────────────────
  // /discover?tab=dreps → /governance/representatives etc.
  if (pathname === '/discover') {
    const tab = searchParams.get('tab');
    if (tab && DISCOVER_TAB_MAP[tab]) {
      return NextResponse.redirect(new URL(DISCOVER_TAB_MAP[tab], request.url), 301);
    }
    // No tab param → handled by next.config.ts redirect to /governance
  }

  // /pulse?tab=history → /governance/health (history merged into health page)
  if (pathname === '/pulse') {
    const tab = searchParams.get('tab');
    if (tab === 'history') {
      return NextResponse.redirect(new URL('/governance/health', request.url), 301);
    }
  }

  // ── Anonymous /governance redirect (server-side for faster nav) ──
  if (pathname === '/governance') {
    const session = request.cookies.get('drepscore_session');
    if (!session?.value) {
      return NextResponse.redirect(new URL('/governance/proposals', request.url));
    }
  }

  // ── Auth gate ─────────────────────────────────────────────────────
  if (AUTH_REQUIRED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const session = request.cookies.get('drepscore_session');
    const isPrefetch =
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose') === 'prefetch' ||
      request.headers.get('x-middleware-prefetch') === '1';
    if (!session?.value) {
      if (isPrefetch) {
        return new NextResponse(null, { status: 204 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ── CORS for public API ───────────────────────────────────────────
  if (!pathname.startsWith('/api/v1')) {
    return NextResponse.next();
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    '/api/v1/:path*',
    '/discover',
    '/governance',
    '/pulse',
    '/workspace/:path*',
    '/you/:path*',
    '/delegation/:path*',
  ],
};
