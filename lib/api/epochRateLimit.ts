/**
 * Per-epoch rate limiting for engagement actions.
 *
 * Prevents spam by capping the number of engagement actions
 * a user can take per epoch. Stored in Redis with epoch-scoped keys.
 *
 * Limits:
 *   - Sentiment votes: 50 per epoch
 *   - Concern flags: 20 per epoch
 *   - Priority signals: 5 per epoch
 */

import { logger } from '@/lib/logger';

interface EpochRateLimitConfig {
  action: 'sentiment' | 'concern' | 'priority';
  userId: string;
  epoch: number;
}

const EPOCH_LIMITS: Record<string, number> = {
  sentiment: 50,
  concern: 20,
  priority: 5,
};

/**
 * Check if a user has exceeded their per-epoch action limit.
 * Uses Redis for storage, falls back to allowing if Redis unavailable.
 *
 * Returns { allowed, remaining, limit }.
 */
export async function checkEpochRateLimit(
  config: EpochRateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = EPOCH_LIMITS[config.action] ?? 50;
  const key = `epoch-rl:${config.action}:${config.epoch}:${config.userId}`;

  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();

    const current = await redis.incr(key);

    // Set TTL on first increment (~6 days, covers epoch duration + buffer)
    if (current === 1) {
      await redis.expire(key, 6 * 24 * 60 * 60);
    }

    const allowed = current <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - current),
      limit,
    };
  } catch (error) {
    // Redis unavailable — allow the action (fail open for epoch limits)
    logger.warn('Epoch rate limit check failed — allowing', {
      action: config.action,
      error,
    });
    return { allowed: true, remaining: limit, limit };
  }
}
