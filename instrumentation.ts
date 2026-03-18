export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');
    validateEnv();

    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.25,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.25,
    });
  }
}

import { createHash } from 'crypto';

function extractSessionPayload(
  cookieHeader: string | undefined,
): { walletAddress?: string } | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/drepscore_session=([^;]+)/);
  if (!match) return null;
  try {
    const parts = match[1].split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
    return payload as { walletAddress?: string };
  } catch {
    return null;
  }
}

function hashAddressServer(address: string): string {
  return createHash('sha256').update(address).digest('hex').slice(0, 16);
}

export async function onRequestError(
  error: { digest: string } & Error,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string },
) {
  const Sentry = await import('@sentry/nextjs');

  const payload = extractSessionPayload(request.headers.cookie ?? request.headers.Cookie);
  const hashedAddress = payload?.walletAddress ? hashAddressServer(payload.walletAddress) : null;

  Sentry.withScope((scope) => {
    if (hashedAddress) {
      scope.setUser({ id: hashedAddress });
      scope.setTag('hashedAddress', hashedAddress);
    }
    scope.setTag('routePath', context.routePath);
    scope.setTag('routeType', context.routeType);
    Sentry.captureRequestError(error, request, context);
  });
}
