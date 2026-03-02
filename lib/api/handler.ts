/**
 * API Handler Wrapper
 * Provides request ID, rate limiting, logging, and error handling for /api/v1/ routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, normalizeEndpoint } from './response';
import { apiError } from './response';
import { checkRateLimit, rateLimitHeaders } from './rateLimit';
import { validateApiKey } from './keys';
import { logApiRequest, trackFirstRequest } from './logging';
import { createHash } from 'crypto';

export interface ApiContext {
  requestId: string;
  keyId?: string | null;
  keyPrefix?: string | null;
  tier: string;
  rateLimitHeaders?: Record<string, string>;
}

type ApiHandler = (request: NextRequest, ctx: ApiContext) => Promise<NextResponse>;

interface HandlerOptions {
  requiredTier?: string;
  skipRateLimit?: boolean;
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function withApiHandler(handler: ApiHandler, options: HandlerOptions = {}) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const startMs = Date.now();
    const endpoint = normalizeEndpoint(request.nextUrl.pathname);

    let keyId: string | null = null;
    let keyPrefix: string | null = null;
    let tier = 'anon';

    try {
      const authHeader = request.headers.get('authorization');
      const rawKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (rawKey) {
        const result = await validateApiKey(rawKey);
        if (result.valid && result.key) {
          keyId = result.key.id;
          keyPrefix = result.key.keyPrefix;
          tier = result.key.tier;
        } else {
          return apiError(result.errorCode || 'invalid_api_key', {}, { requestId });
        }
      }

      if (options.requiredTier && tier === 'anon') {
        return apiError('tier_required', { required: options.requiredTier }, { requestId });
      }

      const ipHash = hashIp(
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      );

      let rlHeaders: Record<string, string> = {};
      if (!options.skipRateLimit) {
        const keyResult = keyId ? await import('./keys').then(m => m.getTierDefaults(tier)) : undefined;
        const rl = await checkRateLimit({
          keyId,
          ipHash,
          limit: keyResult?.rateLimit,
          window: keyResult?.rateWindow,
        });
        rlHeaders = rateLimitHeaders(rl);

        if (!rl.allowed) {
          return apiError('rate_limit_exceeded', {
            limit: rl.limit,
            window: rl.window,
          }, { requestId, rateLimitHeaders: rlHeaders });
        }
      }

      const ctx: ApiContext = { requestId, keyId, keyPrefix, tier, rateLimitHeaders: rlHeaders };
      const response = await handler(request, ctx);

      const responseMs = Date.now() - startMs;
      logApiRequest({
        keyId, keyPrefix, tier, endpoint,
        method: request.method,
        statusCode: response.status,
        responseMs,
        ipHash,
        userAgent: request.headers.get('user-agent'),
      });

      if (keyId && keyPrefix) {
        trackFirstRequest(keyId, keyPrefix, tier, endpoint);
      }

      for (const [k, v] of Object.entries(rlHeaders)) {
        response.headers.set(k, v);
      }

      return response;
    } catch (err) {
      const responseMs = Date.now() - startMs;
      const errorCode = err instanceof Error ? err.message : 'internal_error';

      logApiRequest({
        keyId, keyPrefix, tier, endpoint,
        method: request.method,
        statusCode: 500,
        responseMs,
        errorCode,
      });

      return apiError('internal_error', {}, { requestId });
    }
  };
}
