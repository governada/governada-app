/**
 * Supabase Client Configuration
 * Provides regular client for reads and admin client for writes.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

type SupabaseReadKeyName = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

export type SupabaseReadProbeReason =
  | 'ok'
  | 'missing_url'
  | 'invalid_url'
  | 'missing_read_key'
  | 'client_init_failed'
  | 'query_error'
  | 'timeout'
  | 'unknown_error';

export interface SupabaseReadEnvStatus {
  url: 'present' | 'missing' | 'invalid';
  publishableKey: 'present' | 'missing';
  legacyAnonKey: 'present' | 'missing';
  activeKey: 'publishable' | 'legacy_anon' | 'none';
}

export interface SupabaseReadProbeResult {
  status: 'healthy' | 'unhealthy';
  reason: SupabaseReadProbeReason;
  message: string;
  latencyMs: number;
  env: SupabaseReadEnvStatus;
  errorCode?: string;
  httpStatus?: number;
}

function getSupabasePublishableKey(): string | undefined {
  return (
    getNonEmptyEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
    getNonEmptyEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );
}

function getNonEmptyEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getSupabasePublishableKeyStatus(): SupabaseReadEnvStatus['publishableKey'] {
  return getNonEmptyEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ? 'present' : 'missing';
}

function getSupabaseLegacyAnonKeyStatus(): SupabaseReadEnvStatus['legacyAnonKey'] {
  return getNonEmptyEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 'present' : 'missing';
}

function getSupabaseReadKeyName(): SupabaseReadKeyName | null {
  if (getNonEmptyEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')) {
    return 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY';
  }

  if (getNonEmptyEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
    return 'NEXT_PUBLIC_SUPABASE_ANON_KEY';
  }

  return null;
}

export function getSupabaseReadEnvStatus(): SupabaseReadEnvStatus {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const activeKey = getSupabaseReadKeyName();

  let url: SupabaseReadEnvStatus['url'] = 'present';
  if (!supabaseUrl) {
    url = 'missing';
  } else {
    try {
      new URL(supabaseUrl);
    } catch {
      url = 'invalid';
    }
  }

  return {
    url,
    publishableKey: getSupabasePublishableKeyStatus(),
    legacyAnonKey: getSupabaseLegacyAnonKeyStatus(),
    activeKey:
      activeKey === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
        ? 'publishable'
        : activeKey === 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
          ? 'legacy_anon'
          : 'none',
  };
}

function getSupabaseReadEnvFailure(env: SupabaseReadEnvStatus): SupabaseReadProbeReason | null {
  if (env.url === 'missing') return 'missing_url';
  if (env.url === 'invalid') return 'invalid_url';
  if (env.activeKey === 'none') return 'missing_read_key';
  return null;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 240);
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message.slice(0, 240);
  }

  return 'Unknown Supabase read-client error';
}

function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === 'string' ? value : undefined;
}

function getHttpStatus(error: unknown, fallback?: number): number | undefined {
  if (typeof fallback === 'number') return fallback;
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as { status?: unknown }).status;
  return typeof value === 'number' ? value : undefined;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError')
  );
}

export async function probeSupabaseReadClient(timeoutMs = 5_000): Promise<SupabaseReadProbeResult> {
  const start = Date.now();
  const env = getSupabaseReadEnvStatus();
  const envFailure = getSupabaseReadEnvFailure(env);

  if (envFailure) {
    return {
      status: 'unhealthy',
      reason: envFailure,
      message: `Supabase read-client environment is not usable: ${envFailure}`,
      latencyMs: Date.now() - start,
      env,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const supabase = createClient();
    const { error, status } = await supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .limit(1)
      .abortSignal(controller.signal);

    if (error) {
      return {
        status: 'unhealthy',
        reason: 'query_error',
        message: getSafeErrorMessage(error),
        latencyMs: Date.now() - start,
        env,
        errorCode: getErrorCode(error),
        httpStatus: getHttpStatus(error, typeof status === 'number' ? status : undefined),
      };
    }

    return {
      status: 'healthy',
      reason: 'ok',
      message: 'Supabase read-client query succeeded',
      latencyMs: Date.now() - start,
      env,
      httpStatus: status,
    };
  } catch (error) {
    const timeout = isAbortError(error);
    return {
      status: 'unhealthy',
      reason: timeout ? 'timeout' : 'client_init_failed',
      message: timeout ? 'Supabase read-client query timed out' : getSafeErrorMessage(error),
      latencyMs: Date.now() - start,
      env,
      errorCode: getErrorCode(error),
      httpStatus: getHttpStatus(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Regular Supabase client for reads
 * Uses publishable key - safe for client-side and server-side
 * Read-only access via RLS policies
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = getSupabasePublishableKey();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required; NEXT_PUBLIC_SUPABASE_ANON_KEY is accepted temporarily for legacy compatibility',
    );
  }

  return createSupabaseClient(supabaseUrl, supabasePublishableKey);
}

/**
 * Admin Supabase client for writes.
 * Uses secret key - SERVER-ONLY, never expose to client.
 * Full write access, bypasses RLS.
 *
 * Not a singleton: Supabase JS is HTTP-based so client creation is cheap.
 * Profiled at <0.1ms per call — no measurable benefit from caching.
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseSecretKey) {
    throw new Error('Missing environment variable: SUPABASE_SECRET_KEY (server-only)');
  }

  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
