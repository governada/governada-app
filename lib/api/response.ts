/**
 * API Response Envelope
 * Standardized response format for all /api/v1/ endpoints.
 */

import { NextResponse } from 'next/server';
import { getApiError } from './errors';
import type { ApiErrorDef } from './errors';

type ErrorParams = Record<string, string | number>;

// Epoch derivation (same constants as lib/data.ts)
const SHELLEY_GENESIS = 1596491091;
const EPOCH_LEN = 432000;
const SHELLEY_BASE = 209;

function getCurrentEpoch(): number {
  return Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;
}

let requestCounter = 0;
export function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % 1_000_000;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `req_${ts}_${rand}_${requestCounter.toString(36)}`;
}

export interface ApiMeta {
  request_id: string;
  epoch: number;
  data_cached_at?: string;
  data_age_seconds?: number;
  api_version: string;
}

export interface ApiPagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

interface SuccessOptions {
  requestId: string;
  dataCachedAt?: Date;
  pagination?: ApiPagination;
  cacheSeconds?: number;
  headers?: Record<string, string>;
}

export function apiSuccess(data: unknown, options: SuccessOptions): NextResponse {
  const meta: ApiMeta = {
    request_id: options.requestId,
    epoch: getCurrentEpoch(),
    api_version: 'v1',
  };

  if (options.dataCachedAt) {
    meta.data_cached_at = options.dataCachedAt.toISOString();
    meta.data_age_seconds = Math.round((Date.now() - options.dataCachedAt.getTime()) / 1000);
  }

  const body: Record<string, unknown> = { data, meta };
  if (options.pagination) {
    body.pagination = options.pagination;
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': options.requestId,
    ...(options.headers || {}),
  };

  if (options.cacheSeconds) {
    responseHeaders['Cache-Control'] =
      `public, s-maxage=${options.cacheSeconds}, stale-while-revalidate=${options.cacheSeconds * 2}`;
  }

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: responseHeaders,
  });
}

interface ErrorOptions {
  requestId: string;
  rateLimitHeaders?: Record<string, string>;
}

export function apiError(
  code: string,
  params: ErrorParams = {},
  options: ErrorOptions,
): NextResponse {
  const err = getApiError(code, { ...params, request_id: options.requestId });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': options.requestId,
    ...(options.rateLimitHeaders || {}),
  };

  if (err.status === 429 && options.rateLimitHeaders) {
    const retryAfter = options.rateLimitHeaders['X-RateLimit-Reset'];
    if (retryAfter) {
      headers['Retry-After'] = String(
        Math.max(0, parseInt(retryAfter) - Math.floor(Date.now() / 1000)),
      );
    }
  }

  return new NextResponse(JSON.stringify({ error: err }), {
    status: err.status,
    headers,
  });
}

/**
 * Normalize a URL pathname to a loggable endpoint pattern.
 * /api/v1/dreps/drep1abc... → /v1/dreps/:id
 */
export function normalizeEndpoint(pathname: string): string {
  return pathname
    .replace(/^\/api/, '')
    .replace(/\/dreps\/[^/]+/, '/dreps/:id')
    .replace(/\/proposals\/[^/]+/, '/proposals/:id')
    .replace(/\/embed\/[^/]+/, '/embed/:id');
}

/**
 * Compute data_age_seconds from an updatedAt timestamp.
 */
export function dataAgeSecs(updatedAt: string | Date | null): number | undefined {
  if (!updatedAt) return undefined;
  const ts = typeof updatedAt === 'string' ? new Date(updatedAt).getTime() : updatedAt.getTime();
  return Math.round((Date.now() - ts) / 1000);
}
