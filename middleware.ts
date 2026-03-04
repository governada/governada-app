/**
 * Next.js Middleware
 * - CORS for /api/v1/* routes
 * - Auth gate for /dashboard (redirect to / if no session cookie)
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

const AUTH_REQUIRED_PATHS = ['/dashboard', '/my-gov'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth gate: redirect to home if no session cookie
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

  if (!pathname.startsWith('/api/v1')) {
    return NextResponse.next();
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Add CORS headers to the response
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ['/api/v1/:path*', '/dashboard/:path*', '/my-gov/:path*'],
};
