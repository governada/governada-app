/**
 * Lightweight API handler wrapper for internal (non-v1) routes.
 *
 * Provides: auth, rate limiting, Zod error handling, structured logging,
 * and a catch-all error boundary. Does NOT require API keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import { generateRequestId, normalizeEndpoint } from './response';
import { requireAuth } from '@/lib/supabaseAuth';
import { createHash } from 'crypto';

interface RateLimitConfig {
  max: number;
  /** Window in seconds */
  window: number;
  /** Custom key extractor. Defaults to wallet (if authed) or IP hash. */
  key?: (req: NextRequest, wallet?: string) => string;
}

interface RouteOptions {
  auth?: 'required' | 'optional' | 'none';
  rateLimit?: RateLimitConfig;
}

export interface RouteContext {
  requestId: string;
  userId?: string;
  wallet?: string;
}

type HandlerFn = (request: NextRequest, context: RouteContext) => Promise<NextResponse>;

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

// Simple in-process sliding window rate limiter.
// Uses Upstash when available, falls back to in-memory.
const MEMORY_STORE_MAX = 10_000;
const MEMORY_STORE_EVICT = 1_000;
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/** Evict the oldest entries when the map exceeds the size cap. */
function evictOldest() {
  if (memoryStore.size <= MEMORY_STORE_MAX) return;
  let evicted = 0;
  for (const key of memoryStore.keys()) {
    if (evicted >= MEMORY_STORE_EVICT) break;
    memoryStore.delete(key);
    evicted++;
  }
}

async function checkLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const { Ratelimit } = await import('@upstash/ratelimit');
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.max, `${config.window} s`),
      prefix: 'rl:route',
    });
    const result = await limiter.limit(identifier);
    return { allowed: result.success, remaining: result.remaining };
  } catch {
    // Fall through to in-memory if Redis has a runtime error
  }

  const now = Date.now();
  const windowMs = config.window * 1000;
  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
    evictOldest();
    return { allowed: true, remaining: config.max - 1 };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count };
}

export function withRouteHandler(handler: HandlerFn, options: RouteOptions = {}) {
  const { auth = 'none' } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const startMs = Date.now();

    try {
      // --- Auth ---
      let userId: string | undefined;
      let wallet: string | undefined;

      if (auth === 'required') {
        const result = await requireAuth(request);
        if (result instanceof NextResponse) return result;
        userId = result.userId;
        wallet = result.wallet;
      } else if (auth === 'optional') {
        const result = await requireAuth(request);
        if (!(result instanceof NextResponse)) {
          userId = result.userId;
          wallet = result.wallet;
        }
      }

      // --- Rate limiting ---
      if (options.rateLimit) {
        const key = options.rateLimit.key
          ? options.rateLimit.key(request, wallet)
          : wallet || hashIp(getClientIp(request));

        const rl = await checkLimit(key, options.rateLimit);
        if (!rl.allowed) {
          return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 },
          );
        }
      }

      // --- Execute ---
      const ctx: RouteContext = { requestId, userId, wallet };
      const response = await handler(request, ctx);

      // --- Log ---
      const durationMs = Date.now() - startMs;
      logger.info('API request', {
        context: normalizeEndpoint(request.nextUrl.pathname),
        method: request.method,
        status: response.status,
        durationMs,
        requestId,
      });

      return response;
    } catch (err) {
      const durationMs = Date.now() - startMs;

      if (err instanceof ZodError) {
        const fields = err.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`);
        logger.warn('Validation error', {
          context: normalizeEndpoint(request.nextUrl.pathname),
          requestId,
          fields,
        });
        return NextResponse.json({ error: 'Validation failed', details: fields }, { status: 400 });
      }

      logger.error('Route error', {
        context: normalizeEndpoint(request.nextUrl.pathname),
        method: request.method,
        durationMs,
        requestId,
        error: err,
      });

      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
