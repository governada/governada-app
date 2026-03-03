/**
 * API Usage Logging — fire-and-forget
 * Async insert to api_usage_log + PostHog business events.
 * Never blocks the API response.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';

export interface ApiLogEntry {
  keyId?: string | null;
  keyPrefix?: string | null;
  tier: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseMs?: number;
  dataAgeS?: number;
  ipHash?: string | null;
  userAgent?: string | null;
  errorCode?: string | null;
}

/**
 * Log an API request. Fire-and-forget — caller should NOT await this.
 */
export function logApiRequest(entry: ApiLogEntry): void {
  const supabase = getSupabaseAdmin();

  void supabase
    .from('api_usage_log')
    .insert({
      key_id: entry.keyId || null,
      key_prefix: entry.keyPrefix || null,
      tier: entry.tier,
      endpoint: entry.endpoint,
      method: entry.method,
      status_code: entry.statusCode,
      response_ms: entry.responseMs ?? null,
      data_age_s: entry.dataAgeS ?? null,
      ip_hash: entry.ipHash || null,
      user_agent: entry.userAgent?.slice(0, 200) || null,
      error_code: entry.errorCode || null,
    })
    .then(({ error }) => {
      if (error) console.error('[API Log] Insert failed:', error.message);
    });

  // PostHog business events
  if (entry.statusCode >= 500) {
    captureServerEvent('api_error_5xx', {
      endpoint: entry.endpoint,
      error_code: entry.errorCode,
      status_code: entry.statusCode,
    });
  }

  if (entry.statusCode === 429) {
    captureServerEvent('api_rate_limit_hit', {
      key_prefix: entry.keyPrefix,
      tier: entry.tier,
      endpoint: entry.endpoint,
    });
  }
}

/**
 * Track when a new API key makes its first request.
 */
export function trackFirstRequest(
  keyId: string,
  keyPrefix: string,
  tier: string,
  endpoint: string,
): void {
  const supabase = getSupabaseAdmin();

  void supabase
    .from('api_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('key_id', keyId)
    .then(({ count }) => {
      // If this is the first or second request (race condition safe), fire the event
      if ((count ?? 0) <= 1) {
        captureServerEvent('api_key_first_request', {
          key_prefix: keyPrefix,
          tier,
          endpoint,
        });
      }
    });
}
