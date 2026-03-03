/**
 * Rate Limiting — Upstash Redis (primary) with Supabase fallback.
 *
 * When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, uses
 * @upstash/ratelimit for sub-ms sliding window checks.
 * Otherwise falls back to the original Supabase api_usage_log approach.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';
import { getSupabaseAdmin } from '@/lib/supabase';

const ANON_RATE_LIMIT = 10;
const ANON_RATE_WINDOW = 'hour' as const;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetEpochSeconds: number;
  window: 'hour' | 'day';
  used: number;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(result.resetEpochSeconds),
  };
}

let _hourLimiter: Ratelimit | null = null;
let _dayLimiter: Ratelimit | null = null;

function getUpstashLimiter(window: 'hour' | 'day', limit: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  if (window === 'hour') {
    if (!_hourLimiter) {
      _hourLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, '1 h'),
        prefix: 'rl:hour',
      });
    }
    return _hourLimiter;
  }

  if (!_dayLimiter) {
    _dayLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, '1 d'),
      prefix: 'rl:day',
    });
  }
  return _dayLimiter;
}

export async function checkRateLimit(opts: {
  keyId?: string | null;
  ipHash?: string | null;
  limit?: number;
  window?: 'hour' | 'day';
}): Promise<RateLimitResult> {
  const limit = opts.limit ?? ANON_RATE_LIMIT;
  const window = opts.window ?? ANON_RATE_WINDOW;

  const identifier = opts.keyId ?? opts.ipHash;
  if (!identifier) {
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetEpochSeconds: computeResetEpoch(window),
      window,
      used: 0,
    };
  }

  const upstash = getUpstashLimiter(window, limit);
  if (upstash) {
    return checkUpstash(upstash, identifier, limit, window);
  }

  return checkSupabase(opts, limit, window);
}

async function checkUpstash(
  limiter: Ratelimit,
  identifier: string,
  limit: number,
  window: 'hour' | 'day',
): Promise<RateLimitResult> {
  const result = await limiter.limit(identifier);
  return {
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetEpochSeconds: Math.floor(result.reset / 1000),
    window,
    used: limit - result.remaining,
  };
}

async function checkSupabase(
  opts: { keyId?: string | null; ipHash?: string | null },
  limit: number,
  window: 'hour' | 'day',
): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();

  let query = supabase.from('api_usage_log').select('*', { count: 'exact', head: true });

  if (opts.keyId) {
    query = query.eq('key_id', opts.keyId);
  } else if (opts.ipHash) {
    query = query.eq('ip_hash', opts.ipHash).is('key_id', null);
  }

  query = query.gte('created_at', new Date(Date.now() - windowMs(window)).toISOString());

  const { count } = await query;
  const used = count ?? 0;
  const remaining = limit - used;

  return {
    allowed: remaining > 0,
    limit,
    remaining,
    resetEpochSeconds: computeResetEpoch(window),
    window,
    used,
  };
}

function windowMs(window: 'hour' | 'day'): number {
  return window === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

function computeResetEpoch(window: 'hour' | 'day'): number {
  const now = new Date();
  if (window === 'hour') {
    const reset = new Date(now);
    reset.setMinutes(0, 0, 0);
    reset.setHours(reset.getHours() + 1);
    return Math.floor(reset.getTime() / 1000);
  }
  const reset = new Date(now);
  reset.setHours(0, 0, 0, 0);
  reset.setDate(reset.getDate() + 1);
  return Math.floor(reset.getTime() / 1000);
}
