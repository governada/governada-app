/**
 * Next.js Proxy
 * - CSP nonce generation (per-request, pages only)
 * - Locale detection from Accept-Language header + cookie persistence
 * - Query-param redirects for old /discover?tab= routes
 * - Auth gate for protected routes (workspace, you)
 * - CORS for /api/v1/* routes
 * Auth and rate limiting for API routes are handled in lib/api/handler.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isValidLocale,
  parseAcceptLanguage,
} from '@/lib/i18n/config';
import { LEGACY_SESSION_COOKIE_NAMES, SESSION_COOKIE_NAME } from '@/lib/persistence';

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

/**
 * Build the Content-Security-Policy header with a per-request nonce.
 *
 * Layered for backwards compatibility (OWASP recommended pattern):
 * - CSP Level 3 browsers: nonce + strict-dynamic enforced; unsafe-inline and host sources ignored
 * - CSP Level 2 browsers: nonce enforced; strict-dynamic ignored; host sources provide fallback
 * - CSP Level 1 browsers: unsafe-inline fallback (extremely rare — wallet extensions require modern browsers)
 */
function buildCSP(nonce: string): string {
  return [
    "default-src 'self'",
    // Core: nonce + strict-dynamic for script trust propagation
    // wasm-unsafe-eval: allows WebAssembly.instantiate() for CSL + libsodium (NOT eval())
    // unsafe-inline + host sources: backwards compat fallbacks (ignored by modern browsers when nonce is present)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval' 'unsafe-inline' https://us.i.posthog.com https://*.ingest.us.sentry.io blob:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://us.posthog.com https://*.ingest.us.sentry.io https://*.sentry.io https://api.koios.rest wss://*.supabase.co",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
  ].join('; ');
}

/** Set the locale cookie on a response if not already set correctly */
function withLocale(response: NextResponse, request: NextRequest): NextResponse {
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing && isValidLocale(existing)) return response;

  const detected = parseAcceptLanguage(request.headers.get('accept-language') || '');
  response.cookies.set(LOCALE_COOKIE, detected, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── CSP nonce generation (pages only) ─────────────────────────────
  // Generate a cryptographic nonce per request. Next.js reads this from
  // the CSP response header and applies it to all inline scripts it injects.
  const isPageRoute = !pathname.startsWith('/api');
  const nonce = isPageRoute ? Buffer.from(crypto.randomUUID()).toString('base64') : '';

  // ── Query-param redirects ─────────────────────────────────────────
  // /discover?tab=dreps → /governance/representatives etc.
  if (pathname === '/discover') {
    const tab = searchParams.get('tab');
    if (tab && DISCOVER_TAB_MAP[tab]) {
      return withLocale(
        NextResponse.redirect(new URL(DISCOVER_TAB_MAP[tab], request.url), 301),
        request,
      );
    }
    // No tab param → handled by next.config.ts redirect to /governance
  }

  // /pulse?tab=history → /governance/health (history merged into health page)
  if (pathname === '/pulse') {
    const tab = searchParams.get('tab');
    if (tab === 'history') {
      return withLocale(
        NextResponse.redirect(new URL('/governance/health', request.url), 301),
        request,
      );
    }
  }

  // ── Anonymous /governance redirect (server-side for faster nav) ──
  if (pathname === '/governance') {
    const session = getSessionCookie(request);
    if (!session?.value) {
      return withLocale(
        NextResponse.redirect(new URL('/governance/proposals', request.url)),
        request,
      );
    }
  }

  // ── Auth gate ─────────────────────────────────────────────────────
  if (AUTH_REQUIRED_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const session = getSessionCookie(request);
    const isPrefetch =
      request.headers.get('next-router-prefetch') === '1' ||
      request.headers.get('purpose') === 'prefetch' ||
      request.headers.get('x-middleware-prefetch') === '1';
    if (!session?.value) {
      if (isPrefetch) {
        return new NextResponse(null, { status: 204 });
      }
      return withLocale(NextResponse.redirect(new URL('/', request.url)), request);
    }
  }

  // Block preview users from admin routes
  if (pathname.startsWith('/admin')) {
    const session = getSessionCookie(request);
    if (session?.value) {
      try {
        const payload = JSON.parse(atob(session.value.split('.')[1]));
        if (payload.walletAddress?.startsWith('preview_')) {
          return withLocale(NextResponse.redirect(new URL('/', request.url)), request);
        }
      } catch {
        /* pass through */
      }
    }
  }

  // ── CORS for public API ───────────────────────────────────────────
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

  // ── Default: pass through with nonce + CSP + locale ───────────────
  if (isPageRoute && nonce) {
    // Inject nonce into request headers so Next.js can read it during SSR.
    // Set CSP on both request (for Next.js nonce extraction) and response (for browser enforcement).
    const csp = buildCSP(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return withLocale(response, request);
  }

  return withLocale(NextResponse.next(), request);
}

export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next (static files, images, HMR)
     * - api (except /api/v1 which needs CORS — handled inside middleware)
     * - Static public assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|workbox-|icons/|og-image).*)',
  ],
};
