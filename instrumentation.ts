import { findCookieValue } from './lib/persistence';

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

    // Graceful shutdown: flush Sentry events before container stops
    const shutdown = async (signal: string) => {
      console.log(`[shutdown] ${signal} received — flushing Sentry…`);
      await Sentry.flush(5000).catch(() => {});
      process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
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

async function extractSessionPayload(
  cookieHeader: string | undefined,
): Promise<{ walletAddress?: string } | null> {
  if (!cookieHeader) return null;
  const token = findCookieValue(cookieHeader);
  if (!token) return null;

  try {
    const { validateSessionToken } = await import('@/lib/supabaseAuth');
    const payload = await validateSessionToken(decodeURIComponent(token));
    if (!payload?.walletAddress) {
      return null;
    }

    return { walletAddress: payload.walletAddress };
  } catch {
    return null;
  }
}

async function hashAddressServer(address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(address);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export async function onRequestError(
  error: { digest: string } & Error,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string },
) {
  const Sentry = await import('@sentry/nextjs');

  const payload = await extractSessionPayload(request.headers.cookie ?? request.headers.Cookie);
  const hashedAddress = payload?.walletAddress
    ? await hashAddressServer(payload.walletAddress)
    : null;

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
