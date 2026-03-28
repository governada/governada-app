/**
 * Blockfrost API Adapter
 *
 * Read-only fetch wrapper for cross-referencing Governada data against
 * Blockfrost's independent Cardano db-sync instance.
 *
 * Mirrors the retry/circuit-breaker pattern from utils/koios.ts but tuned
 * for Blockfrost's rate limits (10 req/s burst, daily cap depends on tier).
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import type {
  BlockfrostDRep,
  BlockfrostProposal,
  BlockfrostEpoch,
  BlockfrostNetwork,
  BlockfrostCommittee,
  BlockfrostProposalVotes,
} from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BLOCKFROST_BASE_URL = 'https://cardano-mainnet.blockfrost.io/api/v0';
const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;

let _lastBlockfrost429 = 0;
let _callCount = 0;
let _totalMs = 0;

export function getBlockfrostMetrics() {
  return {
    blockfrost_calls: _callCount,
    blockfrost_avg_ms: _callCount > 0 ? Math.round(_totalMs / _callCount) : 0,
  };
}

export function resetBlockfrostMetrics() {
  _callCount = 0;
  _totalMs = 0;
}

// ---------------------------------------------------------------------------
// Base fetch
// ---------------------------------------------------------------------------

function retryDelay(attempt: number, status?: number): number {
  if (status === 429) {
    // Blockfrost rate limit: 1s, 3s, 10s
    return Math.min(Math.pow(3, attempt) * 1000, 10_000) + Math.random() * 500;
  }
  return Math.pow(2, attempt) * 1000 + Math.random() * 500;
}

async function blockfrostFetch<T>(endpoint: string, retryCount = 0): Promise<T> {
  if (!BLOCKFROST_PROJECT_ID) {
    throw new Error('BLOCKFROST_PROJECT_ID not configured — cannot run reconciliation checks');
  }

  const url = `${BLOCKFROST_BASE_URL}${endpoint}`;

  // Circuit breaker
  if (
    _lastBlockfrost429 &&
    Date.now() - _lastBlockfrost429 < CIRCUIT_BREAKER_COOLDOWN_MS &&
    retryCount === 0
  ) {
    const waitMs = CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - _lastBlockfrost429);
    logger.warn(`[Blockfrost] Rate limit cooldown, waiting ${Math.round(waitMs / 1000)}s`);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const startTime = Date.now();
    const response = await Sentry.startSpan(
      { name: `blockfrost${endpoint}`, op: 'http.client', attributes: { 'http.method': 'GET' } },
      async () =>
        fetch(url, {
          headers: { project_id: BLOCKFROST_PROJECT_ID },
          cache: 'no-store',
          signal: controller.signal,
        }),
    );
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    _callCount++;
    _totalMs += elapsed;

    if (!response.ok) {
      if (response.status === 429) _lastBlockfrost429 = Date.now();

      if (
        (response.status === 429 || response.status === 500 || response.status === 503) &&
        retryCount < MAX_RETRIES
      ) {
        const waitTime = retryDelay(retryCount, response.status);
        logger.warn(
          `[Blockfrost] ${response.status} on ${endpoint}, retrying in ${Math.round(waitTime)}ms (${retryCount + 1}/${MAX_RETRIES})`,
        );
        await new Promise((r) => setTimeout(r, waitTime));
        return blockfrostFetch<T>(endpoint, retryCount + 1);
      }

      throw new Error(
        `Blockfrost API error: ${response.status} ${response.statusText} (${endpoint})`,
      );
    }

    if (_lastBlockfrost429) _lastBlockfrost429 = 0;

    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError' && retryCount < MAX_RETRIES) {
      const waitTime = retryDelay(retryCount);
      logger.warn(
        `[Blockfrost] Timeout on ${endpoint}, retrying (${retryCount + 1}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, waitTime));
      return blockfrostFetch<T>(endpoint, retryCount + 1);
    }

    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`[Blockfrost] ${msg}`, { endpoint, retryCount });
    throw new Error(msg);
  }
}

// ---------------------------------------------------------------------------
// Paginated fetch helper
// ---------------------------------------------------------------------------

async function fetchAllPages<T>(endpoint: string, maxPages = 20): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const items = await blockfrostFetch<T[]>(`${endpoint}${separator}count=100&page=${page}`);
    all.push(...items);
    if (items.length < 100) break; // last page
  }
  return all;
}

// ---------------------------------------------------------------------------
// Governance data fetchers
// ---------------------------------------------------------------------------

/** Fetch all registered DReps (paginated) */
export async function fetchDReps(): Promise<BlockfrostDRep[]> {
  return fetchAllPages<BlockfrostDRep>('/governance/dreps');
}

/** Fetch all governance proposals (paginated) */
export async function fetchProposals(): Promise<BlockfrostProposal[]> {
  return fetchAllPages<BlockfrostProposal>('/governance/proposals');
}

/** Fetch the latest (current) epoch */
export async function fetchLatestEpoch(): Promise<BlockfrostEpoch> {
  return blockfrostFetch<BlockfrostEpoch>('/epochs/latest');
}

/** Fetch network info (includes treasury balance) */
export async function fetchNetwork(): Promise<BlockfrostNetwork> {
  return blockfrostFetch<BlockfrostNetwork>('/network');
}

/** Fetch constitutional committee info */
export async function fetchCommittee(): Promise<BlockfrostCommittee> {
  return blockfrostFetch<BlockfrostCommittee>('/governance/committee');
}

/** Fetch votes for a specific proposal */
export async function fetchProposalVotes(
  txHash: string,
  certIndex: number,
): Promise<BlockfrostProposalVotes[]> {
  return fetchAllPages<BlockfrostProposalVotes>(
    `/governance/proposals/${txHash}/${certIndex}/votes`,
  );
}

/** Fetch a specific DRep's details */
export async function fetchDRepDetail(drepId: string): Promise<BlockfrostDRep> {
  return blockfrostFetch<BlockfrostDRep>(`/governance/dreps/${drepId}`);
}

/** Check if Blockfrost is configured and reachable */
export async function isAvailable(): Promise<boolean> {
  if (!BLOCKFROST_PROJECT_ID) return false;
  try {
    await blockfrostFetch<{ url: string }>('/');
    return true;
  } catch {
    return false;
  }
}
