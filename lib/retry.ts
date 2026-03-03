/**
 * Shared retry helper with exponential backoff.
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Return true if the error is transient and should be retried. Defaults to always true. */
  isTransient?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number) => void;
  label?: string;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

function computeDelay(attempt: number, baseMs: number, maxMs: number): number {
  const jitter = Math.random() * 0.3 + 0.85;
  return Math.min(baseMs * Math.pow(2, attempt) * jitter, maxMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const isTransient = options?.isTransient ?? (() => true);
  const label = options?.label ?? 'retry';

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !isTransient(err)) {
        throw err;
      }

      const delayMs = computeDelay(attempt, baseDelayMs, maxDelayMs);

      if (options?.onRetry) {
        options.onRetry(err, attempt + 1);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`[${label}] Retrying after transient error`, {
          attempt: attempt + 1,
          maxRetries,
          delayMs: Math.round(delayMs),
          error: msg,
        });
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}
