/**
 * Rate Limiting — Upstash Redis only.
 * Redis is required in production. If Upstash is unreachable at runtime,
 * we fail closed (deny request) rather than falling back to DB writes.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

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

const _limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(window: 'hour' | 'day', limit: number): Ratelimit {
  const redis = getRedis();
  const cacheKey = `${window}:${limit}`;

  let limiter = _limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window === 'hour' ? '1 h' : '1 d'),
      prefix: `rl:${window}:${limit}`,
    });
    _limiterCache.set(cacheKey, limiter);
  }
  return limiter;
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

  const limiter = getUpstashLimiter(window, limit);

  try {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetEpochSeconds: Math.floor(result.reset / 1000),
      window,
      used: limit - result.remaining,
    };
  } catch (error) {
    logger.error('Redis rate limit check failed — failing closed', { error });
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetEpochSeconds: computeResetEpoch(window),
      window,
      used: limit,
    };
  }
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
