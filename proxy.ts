/**
 * Next.js Proxy
 * - Request-scoped CSP nonce generation for app/private pages only
 * - Query-param redirects for old /discover?tab= routes
 * - Auth gate for protected routes (workspace, you)
 * - CORS for /api/v1/* routes
 * Auth and rate limiting for API routes are handled in lib/api/handler.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LEGACY_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME } from '@/lib/persistence';
import { buildNonceCsp, pathnameNeedsNonceCsp } from '@/lib/security/csp';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
  'Access-Control-Expose-Headers':
    'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
  'Access-Control-Max-Age': '86400',
};

/** Old /discover?tab= -> new /governance/* routes */
const DISCOVER_TAB_MAP: Record<string, string> = {
  dreps: '/?filter=dreps',
  spos: '/?filter=spos',
  proposals: '/?filter=proposals',
  committee: '/governance/committee',
  rankings: '/?filter=dreps&view=rankings',
};

const AUTH_REQUIRED_PATHS = ['/workspace', '/you'];

function getSessionCookie(request: NextRequest) {
  return (
    request.cookies.get(SESSION_COOKIE_NAME) ??
    LEGACY_SESSION_COOKIE_NAMES.map((name) => request.cookies.get(name)).find(Boolean)
  );
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isDev = process.env.NODE_ENV === 'development';

  const isPageRoute = !pathname.startsWith('/api');
  const needsNonceCsp = isPageRoute && pathnameNeedsNonceCsp(pathname);
  const nonce = needsNonceCsp ? Buffer.from(crypto.randomUUID()).toString('base64') : '';

  if (pathname === '/discover') {
    const tab = searchParams.get('tab');
    if (tab && DISCOVER_TAB_MAP[tab]) {
      return NextResponse.redirect(new URL(DISCOVER_TAB_MAP[tab], request.url), 301);
    }
  }

  if (pathname === '/pulse') {
    const tab = searchParams.get('tab');
    if (tab === 'history') {
      return NextResponse.redirect(new URL('/governance/health', request.url), 301);
    }
  }

  if (pathname === '/governance') {
    const session = getSessionCookie(request);
    if (!session?.value) {
      return NextResponse.redirect(new URL('/governance/proposals', request.url));
    }
  }

  if (AUTH_REQUIRED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const session = getSessionCookie(request);
    const isPrefetch =
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose') === 'prefetch' ||
      request.headers.get('x-middleware-prefetch') === '1';
    if (!session?.value) {
      if (isPrefetch) {
        return new NextResponse(null, { status: 204 });
      }
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('connect', '1');
      redirectUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (pathname.startsWith('/admin')) {
    const session = getSessionCookie(request);
    if (session?.value) {
      try {
        const payload = JSON.parse(atob(session.value.split('.')[1]));
        if (payload.walletAddress?.startsWith('preview_')) {
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch {
        /* pass through */
      }
    }
  }

  if (pathname.startsWith('/api/v1')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  if (needsNonceCsp && nonce) {
    const csp = buildNonceCsp(nonce, { isDev });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next (static files, images, HMR)
     * - api (except /api/v1 which needs CORS - handled inside middleware)
     * - Static public assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-|icons/|og-image).*)',
  ],
};
