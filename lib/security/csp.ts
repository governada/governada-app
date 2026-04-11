const THIRD_PARTY_SCRIPT_SOURCES = [
  'https://us.i.posthog.com',
  'https://*.ingest.us.sentry.io',
  'blob:',
];

const CONNECT_SOURCES = [
  'https://*.supabase.co',
  'https://us.i.posthog.com',
  'https://us.posthog.com',
  'https://*.ingest.us.sentry.io',
  'https://*.sentry.io',
  'https://api.koios.rest',
  'wss://*.supabase.co',
];

export const NONCE_CSP_PATH_PREFIXES = Object.freeze([
  '/admin',
  '/workspace',
  '/you',
  '/my-gov',
  '/claim',
  '/preview',
  '/dev',
]);

function appendDevScriptSources(sources: string[], isDev: boolean) {
  return isDev ? [...sources, "'unsafe-eval'"] : sources;
}

function appendDevConnectSources(sources: string[], isDev: boolean) {
  return isDev ? [...sources, 'ws:'] : sources;
}

export function pathnameNeedsNonceCsp(pathname: string): boolean {
  return NONCE_CSP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function buildPublicCsp({ isDev }: { isDev: boolean }): string {
  const scriptSources = appendDevScriptSources(["'self'", ...THIRD_PARTY_SCRIPT_SOURCES], isDev);
  const connectSources = appendDevConnectSources(["'self'", ...CONNECT_SOURCES], isDev);

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
  ].join('; ');
}

export function buildNonceCsp(nonce: string, { isDev }: { isDev: boolean }): string {
  const scriptSources = appendDevScriptSources(
    [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      "'unsafe-inline'",
      ...THIRD_PARTY_SCRIPT_SOURCES,
    ],
    isDev,
  );
  const connectSources = appendDevConnectSources(["'self'", ...CONNECT_SOURCES], isDev);

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
  ].join('; ');
}
