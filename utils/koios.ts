/**
 * Koios API Integration Layer
 * Provides typed helpers for fetching Cardano governance data
 */

import {
  DRepListResponse,
  DRepInfoResponse,
  DRepMetadata,
  DRepMetadataResponse,
  DRepVote,
  DRepVotesResponse,
  ProposalListResponse,
  ProposalVotingSummaryData,
  SPOVote,
  CCVote,
  KoiosAccountInfo,
} from '@/types/koios';

const KOIOS_BASE_URL = process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1';
const KOIOS_API_KEY = process.env.KOIOS_API_KEY;

// Hard timeout per Koios request — prevents a hung connection from consuming the full function budget
const KOIOS_REQUEST_TIMEOUT_MS = 20_000;

let _koiosCallCount = 0;
let _koiosTotalMs = 0;
let _koiosSlowestMs = 0;

export function resetKoiosMetrics() {
  _koiosCallCount = 0;
  _koiosTotalMs = 0;
  _koiosSlowestMs = 0;
}
export function getKoiosMetrics() {
  return {
    koios_calls: _koiosCallCount,
    koios_latency_ms: _koiosCallCount > 0 ? Math.round(_koiosTotalMs / _koiosCallCount) : 0,
    koios_slowest_ms: _koiosSlowestMs,
  };
}

const MAX_RETRIES = 4;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;
let _lastKoios503 = 0;

function retryDelay(attempt: number, status?: number): number {
  // 429 rate limits need longer cooldowns: 2s, 8s, 30s, 30s
  if (status === 429) {
    const base = Math.min(Math.pow(4, attempt) * 2000, 30_000);
    return base + Math.random() * 2000;
  }
  // 503 / timeouts: 2s, 4s, 8s, 16s with jitter
  const base = Math.pow(2, attempt) * 2000;
  return base + Math.random() * 1000;
}

/**
 * Base fetch wrapper with per-request timeout, cache bypass, rate-limit retry,
 * and circuit breaker for 503 Service Unavailable.
 */
async function koiosFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0,
): Promise<T> {
  const url = `${KOIOS_BASE_URL}${endpoint}`;
  const isDev = process.env.NODE_ENV === 'development';

  // Circuit breaker: if Koios returned 503 recently, wait before hammering it
  if (
    _lastKoios503 &&
    Date.now() - _lastKoios503 < CIRCUIT_BREAKER_COOLDOWN_MS &&
    retryCount === 0
  ) {
    const waitMs = CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - _lastKoios503);
    console.warn(
      `[Koios] Circuit breaker active, waiting ${Math.round(waitMs / 1000)}s before ${endpoint}`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(KOIOS_API_KEY && { Authorization: `Bearer ${KOIOS_API_KEY}` }),
    ...options.headers,
  };

  if (isDev) {
    console.log(`[Koios] Fetching: ${endpoint}`, options.method || 'GET');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KOIOS_REQUEST_TIMEOUT_MS);

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    _koiosCallCount++;
    _koiosTotalMs += elapsed;
    if (elapsed > _koiosSlowestMs) _koiosSlowestMs = elapsed;

    if (isDev) {
      console.log(`[Koios] ${endpoint} completed in ${elapsed}ms`);
    }

    if (!response.ok) {
      if (response.status === 503) _lastKoios503 = Date.now();

      if ((response.status === 429 || response.status === 503) && retryCount < MAX_RETRIES) {
        const waitTime = retryDelay(retryCount, response.status);
        console.warn(
          `[Koios] ${response.status} on ${endpoint}, retrying in ${Math.round(waitTime)}ms (${retryCount + 1}/${MAX_RETRIES})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return koiosFetch<T>(endpoint, options, retryCount + 1);
      }

      throw new Error(`Koios API error: ${response.status} ${response.statusText}`);
    }

    // Clear circuit breaker on success
    if (_lastKoios503) _lastKoios503 = 0;

    const data = await response.json();
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError' && retryCount < MAX_RETRIES) {
      const waitTime = retryDelay(retryCount);
      console.warn(
        `[Koios] Timeout on ${endpoint}, retrying in ${Math.round(waitTime)}ms (${retryCount + 1}/${MAX_RETRIES})...`,
      );
      await new Promise((r) => setTimeout(r, waitTime));
      return koiosFetch<T>(endpoint, options, retryCount + 1);
    }

    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const errorMessage = isTimeout
      ? `Request timeout after ${KOIOS_REQUEST_TIMEOUT_MS}ms: ${endpoint}`
      : error instanceof Error
        ? error.message
        : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    const msg = errorMessage || 'Unknown error fetching from Koios';
    console.error(`[Koios] API Error: ${msg}`, {
      endpoint,
      retryable: retryCount < MAX_RETRIES,
      retryCount,
      stack: errorStack,
    });
    throw new Error(msg);
  }
}

/** Page size for drep_list pagination (Koios may limit default responses) */
const DREP_LIST_PAGE_SIZE = 500;

/**
 * Fetch all DReps from drep_list with pagination
 * Koios API may return limited results by default; paginate to load all
 */
async function fetchAllDRepList(): Promise<DRepListResponse> {
  const isDev = process.env.NODE_ENV === 'development';
  const all: DRepListResponse = [];
  let offset = 0;
  let page = 0;

  while (true) {
    const url = `/drep_list?limit=${DREP_LIST_PAGE_SIZE}&offset=${offset}`;
    const data = await koiosFetch<DRepListResponse>(url);
    const pageData = data || [];

    all.push(...pageData);
    page++;

    if (isDev) {
      console.log(
        `[Koios] drep_list page ${page}: ${pageData.length} DReps (total: ${all.length})`,
      );
    }

    if (pageData.length < DREP_LIST_PAGE_SIZE) {
      break;
    }
    offset += DREP_LIST_PAGE_SIZE;
  }

  if (isDev && page > 1) {
    console.log(`[Koios] Fetched ${all.length} DReps from drep_list (${page} pages)`);
  }

  return all;
}

/**
 * Fetch all registered DReps (paginated to load full list).
 * Throws on failure — callers must handle errors.
 */
export async function fetchAllDReps(): Promise<DRepListResponse> {
  const data = await fetchAllDRepList();
  return data || [];
}

/**
 * Fetch detailed information for specific DReps.
 * Throws on failure — callers must handle errors.
 */
export async function fetchDRepInfo(drepIds: string[]): Promise<DRepInfoResponse> {
  if (drepIds.length === 0) return [];
  const data = await koiosFetch<DRepInfoResponse>('/drep_info', {
    method: 'POST',
    body: JSON.stringify({ _drep_ids: drepIds }),
  });
  return data || [];
}

/**
 * Fetch metadata for specific DReps.
 * Includes name, ticker, description from metadata JSON.
 * Throws on failure — callers must handle errors.
 */
export async function fetchDRepMetadata(drepIds: string[]): Promise<DRepMetadataResponse> {
  if (drepIds.length === 0) return [];
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log(
      `[Koios] Fetching metadata for ${drepIds.length} DReps (includes name, ticker, description)`,
    );
  }

  const data = await koiosFetch<DRepMetadataResponse>('/drep_metadata', {
    method: 'POST',
    body: JSON.stringify({ _drep_ids: drepIds }),
  });

  if (isDev && data) {
    const withCIP119Names = data.filter((m) => m.meta_json?.body?.givenName).length;
    const withLegacyNames = data.filter((m) => m.meta_json?.name).length;
    const withTickers = data.filter((m) => m.meta_json?.ticker).length;
    const withCIP119Objectives = data.filter((m) => m.meta_json?.body?.objectives).length;
    const withLegacyDescriptions = data.filter((m) => m.meta_json?.description).length;
    const withAnchorUrl = data.filter((m) => m.meta_url !== null).length;

    const totalNames = withCIP119Names + withLegacyNames;
    const totalDescriptions = withCIP119Objectives + withLegacyDescriptions;

    console.log(
      `[Koios] Metadata: ${totalNames} with names (${withCIP119Names} CIP-119, ${withLegacyNames} legacy), ${withTickers} with tickers, ${totalDescriptions} with descriptions (${withCIP119Objectives} CIP-119, ${withLegacyDescriptions} legacy), ${withAnchorUrl} with anchor URLs`,
    );
  }

  return data || [];
}

/**
 * Extract value from JSON-LD format metadata
 * Handles both plain strings and JSON-LD objects with @value property
 */
function extractJsonLdValue(value: any): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  // If it's already a string, return it
  if (typeof value === 'string') {
    return value;
  }
  // If it's a JSON-LD object with @value, extract it
  if (typeof value === 'object' && '@value' in value) {
    return String(value['@value']);
  }
  // If it's another type of object, stringify it (last resort)
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  // Fallback: convert to string
  return String(value);
}

/**
 * Extract metadata fields with fallback parsing
 * Handles various metadata JSON structures including CIP-119 governance format
 */
export function parseMetadataFields(metadata: DRepMetadata | null | undefined): {
  name: string | null;
  ticker: string | null;
  description: string | null;
} {
  if (!metadata || !metadata.meta_json) {
    return { name: null, ticker: null, description: null };
  }

  const json = metadata.meta_json;

  // NAME EXTRACTION (priority order)
  // 1. Try direct fields first (custom/legacy format)
  let name = extractJsonLdValue(json.name);

  // 2. Try CIP-119 standard: body.givenName (primary governance metadata field)
  if (!name && json.body) {
    name = extractJsonLdValue((json.body as any).givenName);
  }

  // 3. Try nested body.name (legacy nested format)
  if (!name && json.body) {
    name = extractJsonLdValue((json.body as any).name);
  }

  // 4. Try givenName at root (alternative location)
  if (!name) {
    name = extractJsonLdValue((json as any).givenName);
  }

  // TICKER EXTRACTION (not part of CIP-119, but check legacy formats)
  let ticker = extractJsonLdValue(json.ticker);
  if (!ticker && json.body) {
    ticker = extractJsonLdValue((json.body as any).ticker);
  }

  // DESCRIPTION EXTRACTION (priority order)
  // 1. Try direct description field (custom/legacy)
  let description = extractJsonLdValue(json.description);

  // 2. Try CIP-119 standard: body.objectives (primary description field)
  if (!description && json.body) {
    const objectives = extractJsonLdValue((json.body as any).objectives);
    const motivations = extractJsonLdValue((json.body as any).motivations);

    // Combine objectives and motivations if both exist
    if (objectives && motivations) {
      description = `${objectives}\n\n${motivations}`;
    } else {
      description = objectives || motivations || null;
    }
  }

  // 3. Try nested body.description (legacy nested format)
  if (!description && json.body) {
    description = extractJsonLdValue((json.body as any).description);
  }

  return { name, ticker, description };
}

/**
 * Fetch voting history for a specific DRep.
 * Throws on failure — callers must handle errors.
 */
export async function fetchDRepVotes(drepId: string): Promise<DRepVotesResponse> {
  const data = await koiosFetch<DRepVotesResponse>('/drep_votes', {
    method: 'POST',
    body: JSON.stringify({ _drep_id: drepId }),
  });
  return data || [];
}

/**
 * Fetch details for a single DRep (convenience function)
 */
export async function fetchDRepDetails(drepId: string) {
  try {
    const [info, metadata, votes] = await Promise.all([
      fetchDRepInfo([drepId]),
      fetchDRepMetadata([drepId]),
      fetchDRepVotes(drepId),
    ]);

    return {
      info: info[0] || null,
      metadata: metadata[0] || null,
      votes: votes || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Koios] Error fetching DRep details:', errorMessage);
    return {
      info: null,
      metadata: null,
      votes: [],
    };
  }
}

/** Page size for proposal_list pagination */
const PROPOSAL_LIST_PAGE_SIZE = 500;

/**
 * Fetch all proposals from /proposal_list with pagination.
 * Throws on failure — callers must handle errors.
 */
export async function fetchProposals(): Promise<ProposalListResponse> {
  const isDev = process.env.NODE_ENV === 'development';
  const all: ProposalListResponse = [];
  let offset = 0;
  let page = 0;

  while (true) {
    const url = `/proposal_list?limit=${PROPOSAL_LIST_PAGE_SIZE}&offset=${offset}`;
    const data = await koiosFetch<ProposalListResponse>(url);
    const pageData = data || [];

    all.push(...pageData);
    page++;

    if (isDev) {
      console.log(
        `[Koios] proposal_list page ${page}: ${pageData.length} proposals (total: ${all.length})`,
      );
    }

    if (pageData.length < PROPOSAL_LIST_PAGE_SIZE) {
      break;
    }
    offset += PROPOSAL_LIST_PAGE_SIZE;
  }

  if (isDev && page > 1) {
    console.log(`[Koios] Fetched ${all.length} proposals from proposal_list (${page} pages)`);
  }

  return all;
}

/**
 * Batch fetch DRep info and metadata for multiple DReps
 */
export async function fetchDRepsWithDetails(drepIds: string[]) {
  try {
    const batchSize = 50; // Koios API batch limit
    const batches = [];

    for (let i = 0; i < drepIds.length; i += batchSize) {
      const batch = drepIds.slice(i, i + batchSize);
      batches.push(Promise.all([fetchDRepInfo(batch), fetchDRepMetadata(batch)]));
    }

    const results = await Promise.all(batches);

    // Combine results from all batches
    const allInfo = results.flatMap(([info]) => info);
    const allMetadata = results.flatMap(([, metadata]) => metadata);

    return {
      info: allInfo,
      metadata: allMetadata,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Koios] Error fetching DReps with details:', errorMessage);
    return {
      info: [],
      metadata: [],
    };
  }
}

/**
 * Batch fetch votes for multiple DReps
 * Note: This can be slow for many DReps, use sparingly
 */
export async function fetchDRepsVotes(
  drepIds: string[],
): Promise<Record<string, DRepVotesResponse>> {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    if (isDev) {
      console.log(`[Koios] Fetching votes for ${drepIds.length} DReps...`);
    }

    // Fetch votes sequentially to avoid overwhelming the API
    const votesMap: Record<string, DRepVotesResponse> = {};

    for (const drepId of drepIds) {
      try {
        const votes = await fetchDRepVotes(drepId);
        votesMap[drepId] = votes;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Koios] Error fetching votes for ${drepId}:`, errorMessage);
        votesMap[drepId] = [];
      }
    }

    return votesMap;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Koios] Error fetching DReps votes:', errorMessage);
    return {};
  }
}

/**
 * Get total number of governance proposals.
 * Used for calculating participation rates. Returns fallback estimate on error
 * since this is a non-critical read path.
 */
export async function fetchProposalCount(): Promise<number> {
  try {
    const proposals = await fetchProposals();
    return proposals.length || 100;
  } catch {
    return 100;
  }
}

/**
 * Fetch the DRep ID a given stake address is currently delegated to.
 * Client-safe (no server-only caching). Returns null if not delegated.
 */
export async function fetchDelegatedDRep(stakeAddress: string): Promise<string | null> {
  try {
    const data = await koiosFetch<Array<{ vote_delegation?: string; delegated_drep?: string }>>(
      '/account_info',
      { method: 'POST', body: JSON.stringify({ _stake_addresses: [stakeAddress] }) },
    );
    const account = Array.isArray(data) ? data[0] : null;
    return account?.vote_delegation || account?.delegated_drep || null;
  } catch (err) {
    console.error('[Koios] Error fetching delegated DRep:', err);
    return null;
  }
}

/**
 * Fetch delegator count for a DRep.
 * Uses koiosFetch for retry/circuit-breaker, then counts returned rows.
 * Throws on API failure — callers must handle errors.
 */
export async function fetchDRepDelegatorCount(drepId: string): Promise<number> {
  try {
    const data = await koiosFetch<Array<{ stake_address: string }>>(
      `/drep_delegators?_drep_id=${encodeURIComponent(drepId)}&select=stake_address`,
    );
    return Array.isArray(data) ? data.length : 0;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch delegator count for ${drepId}: ${msg}`);
  }
}

/**
 * Fetch voting power history for a DRep (all epochs).
 * Used for backfilling historical power snapshots.
 */
export async function fetchDRepVotingPowerHistory(
  drepId: string,
): Promise<{ epoch_no: number; amount: string }[]> {
  const data = await koiosFetch<{ drep_id: string; epoch_no: number; amount: string }[]>(
    `/drep_voting_power_history?_drep_id=${encodeURIComponent(drepId)}`,
  );
  return (data || []).map(({ epoch_no, amount }) => ({ epoch_no, amount }));
}

/** Koios epoch_params DVT threshold fields (decimal 0–1) */
interface GovernanceThresholdParams {
  dvt_motion_no_confidence?: number;
  dvt_committee_normal?: number;
  dvt_committee_no_confidence?: number;
  dvt_update_to_constitution?: number;
  dvt_hard_fork_initiation?: number;
  dvt_p_p_network_group?: number;
  dvt_p_p_economic_group?: number;
  dvt_p_p_technical_group?: number;
  dvt_p_p_gov_group?: number;
  dvt_treasury_withdrawal?: number;
}

/**
 * Fetch governance threshold parameters from current epoch.
 */
export async function fetchGovernanceThresholds(): Promise<Record<string, number> | null> {
  try {
    const data = await koiosFetch<GovernanceThresholdParams[]>(
      '/epoch_params?limit=1&select=dvt_motion_no_confidence,dvt_committee_normal,dvt_committee_no_confidence,dvt_update_to_constitution,dvt_hard_fork_initiation,dvt_p_p_network_group,dvt_p_p_economic_group,dvt_p_p_technical_group,dvt_p_p_gov_group,dvt_treasury_withdrawal',
    );
    if (!data || data.length === 0) return null;
    return data[0] as Record<string, number>;
  } catch {
    return null;
  }
}

/**
 * Bulk-fetch ALL DRep votes using /vote_list (paginated).
 * Returns a map of drepId -> DRepVote[] across all proposals.
 * Much faster than per-DRep fetching: ~5-10 paginated calls instead of ~250 individual calls.
 */
const VOTE_LIST_PAGE_SIZE = 1000;

export async function fetchAllVotesBulk(): Promise<Record<string, DRepVote[]>> {
  const allVotes: Record<string, DRepVote[]> = {};
  let offset = 0;
  let page = 0;

  while (true) {
    const url = `/vote_list?voter_role=eq.DRep&limit=${VOTE_LIST_PAGE_SIZE}&offset=${offset}`;
    const data = await koiosFetch<
      Array<{
        vote_tx_hash: string;
        voter_id: string;
        proposal_tx_hash: string;
        proposal_index: number;
        proposal_type: string;
        epoch_no: number;
        block_time: number;
        vote: 'Yes' | 'No' | 'Abstain';
        meta_url: string | null;
        meta_hash: string | null;
        meta_json: DRepVote['meta_json'];
      }>
    >(url, { cache: 'no-store' });

    const pageData = data || [];
    page++;

    for (const row of pageData) {
      const drepId = row.voter_id;
      if (!allVotes[drepId]) allVotes[drepId] = [];
      allVotes[drepId].push({
        proposal_tx_hash: row.proposal_tx_hash,
        proposal_index: row.proposal_index,
        vote_tx_hash: row.vote_tx_hash,
        block_time: row.block_time,
        vote: row.vote,
        meta_url: row.meta_url,
        meta_hash: row.meta_hash,
        meta_json: row.meta_json,
        epoch_no: row.epoch_no,
      });
    }

    console.log(
      `[Koios] vote_list page ${page}: ${pageData.length} votes (total DReps so far: ${Object.keys(allVotes).length})`,
    );

    if (pageData.length < VOTE_LIST_PAGE_SIZE) break;
    offset += VOTE_LIST_PAGE_SIZE;
  }

  return allVotes;
}

/**
 * Fetch votes for specific proposals only (for fast sync).
 * Uses /vote_list with proposal_tx_hash filter, parallelized up to VOTE_FETCH_CONCURRENCY.
 * Running proposals in parallel cuts fast sync vote fetch from O(n*serial) to O(n/5*serial).
 */
export async function fetchVotesForProposals(
  proposals: { txHash: string; index: number }[],
): Promise<Record<string, DRepVote[]>> {
  const allVotes: Record<string, DRepVote[]> = {};
  const VOTE_FETCH_CONCURRENCY = 5;

  const fetchOne = async ({ txHash, index }: { txHash: string; index: number }): Promise<void> => {
    let offset = 0;
    while (true) {
      const url = `/vote_list?voter_role=eq.DRep&proposal_tx_hash=eq.${encodeURIComponent(txHash)}&proposal_index=eq.${index}&limit=${VOTE_LIST_PAGE_SIZE}&offset=${offset}`;
      const data = await koiosFetch<
        Array<{
          vote_tx_hash: string;
          voter_id: string;
          proposal_tx_hash: string;
          proposal_index: number;
          epoch_no: number;
          block_time: number;
          vote: 'Yes' | 'No' | 'Abstain';
          meta_url: string | null;
          meta_hash: string | null;
          meta_json: DRepVote['meta_json'];
        }>
      >(url);

      const pageData = data || [];
      for (const row of pageData) {
        const drepId = row.voter_id;
        if (!allVotes[drepId]) allVotes[drepId] = [];
        allVotes[drepId].push({
          proposal_tx_hash: row.proposal_tx_hash,
          proposal_index: row.proposal_index,
          vote_tx_hash: row.vote_tx_hash,
          block_time: row.block_time,
          vote: row.vote,
          meta_url: row.meta_url,
          meta_hash: row.meta_hash,
          meta_json: row.meta_json,
          epoch_no: row.epoch_no,
        });
      }

      if (pageData.length < VOTE_LIST_PAGE_SIZE) break;
      offset += VOTE_LIST_PAGE_SIZE;
    }
  };

  for (let i = 0; i < proposals.length; i += VOTE_FETCH_CONCURRENCY) {
    await Promise.all(proposals.slice(i, i + VOTE_FETCH_CONCURRENCY).map(fetchOne));
  }

  return allVotes;
}

/**
 * Fetch canonical voting summary for a proposal from Koios.
 * Uses CIP-129 bech32 proposal_id (gov_action1...).
 * Returns the on-chain aggregate tallies including system auto-DReps.
 * Returns null if no data exists for the proposal (not an error).
 * Throws on API/network errors — callers must handle.
 */
export async function fetchProposalVotingSummary(
  proposalId: string,
): Promise<ProposalVotingSummaryData | null> {
  const data = await koiosFetch<ProposalVotingSummaryData[]>(
    `/proposal_voting_summary?_proposal_id=${encodeURIComponent(proposalId)}`,
  );
  return data?.[0] || null;
}

/**
 * Check if Koios API is available.
 * Uses koiosFetch for consistency but catches all errors to return boolean.
 */
export async function checkKoiosHealth(): Promise<boolean> {
  try {
    await koiosFetch<unknown[]>('/tip');
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Treasury Data
// ---------------------------------------------------------------------------

interface KoiosTotalsRow {
  epoch_no: number;
  circulation: string;
  treasury: string;
  reward: string;
  supply: string;
  reserves: string;
}

/**
 * Fetch treasury balance for the current epoch (latest row from /totals).
 */
export async function fetchTreasuryBalance(): Promise<{
  epoch: number;
  balance: bigint;
  reserves: bigint;
  circulation: bigint;
}> {
  const data = await koiosFetch<KoiosTotalsRow[]>('/totals?limit=1&order=epoch_no.desc');
  if (!data || data.length === 0) {
    throw new Error('No treasury data returned from Koios /totals');
  }
  const row = data[0];
  return {
    epoch: row.epoch_no,
    balance: BigInt(row.treasury),
    reserves: BigInt(row.reserves),
    circulation: BigInt(row.circulation),
  };
}

/**
 * Fetch treasury history (multiple epochs) from /totals.
 * Returns rows ordered by epoch ascending.
 */
export async function fetchTreasuryHistory(
  epochCount = 100,
): Promise<
  Array<{ epoch: number; balance: bigint; reserves: bigint; supply: bigint; fees: bigint }>
> {
  const data = await koiosFetch<KoiosTotalsRow[]>(
    `/totals?limit=${epochCount}&order=epoch_no.desc`,
  );
  if (!data) return [];
  return data
    .map((row) => ({
      epoch: row.epoch_no,
      balance: BigInt(row.treasury),
      reserves: BigInt(row.reserves),
      supply: BigInt(row.supply),
      fees: BigInt(row.reward),
    }))
    .reverse();
}

// ---------------------------------------------------------------------------
// ADA Handle Resolution
// ---------------------------------------------------------------------------

import { bech32 } from 'bech32';

const ADA_HANDLE_POLICY_ID = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';
const HANDLE_BATCH_SIZE = 50;

/**
 * Derive a mainnet reward (stake) address from a DRep credential key hash.
 * DRep key hash == stake key hash for key-based DReps (CIP-1694).
 * Header byte 0xe1 = mainnet reward address with key-hash credential.
 */
function drepHashToStakeAddress(drepHash: string): string | null {
  try {
    if (drepHash.length !== 56) return null;
    const payload = Buffer.from('e1' + drepHash, 'hex');
    const words = bech32.toWords(payload);
    return bech32.encode('stake', words, 200);
  } catch {
    return null;
  }
}

interface AccountAssetRow {
  stake_address: string;
  policy_id: string;
  asset_name: string;
  quantity: string;
}

/**
 * Resolve ADA Handles for a batch of DReps by querying Koios account_assets.
 * Returns a Map of drepId → "$handleName".
 */
export async function resolveADAHandles(
  dreps: Array<{ drepId: string; drepHash: string }>,
): Promise<Map<string, string>> {
  const handleMap = new Map<string, string>();
  const stakeTodrep = new Map<string, string>();

  for (const d of dreps) {
    const addr = drepHashToStakeAddress(d.drepHash);
    if (addr) stakeTodrep.set(addr, d.drepId);
  }

  const stakeAddresses = [...stakeTodrep.keys()];

  for (let i = 0; i < stakeAddresses.length; i += HANDLE_BATCH_SIZE) {
    const batch = stakeAddresses.slice(i, i + HANDLE_BATCH_SIZE);
    try {
      const data = await koiosFetch<AccountAssetRow[]>(
        `/account_assets?policy_id=eq.${ADA_HANDLE_POLICY_ID}`,
        {
          method: 'POST',
          body: JSON.stringify({ _stake_addresses: batch }),
        },
      );

      for (const row of data || []) {
        if (row.policy_id !== ADA_HANDLE_POLICY_ID) continue;
        const drepId = stakeTodrep.get(row.stake_address);
        if (!drepId) continue;
        if (handleMap.has(drepId)) continue;
        try {
          const name = Buffer.from(row.asset_name, 'hex').toString('utf8');
          if (name && !name.startsWith('\x00')) {
            handleMap.set(drepId, `$${name}`);
          }
        } catch {
          /* skip malformed asset names */
        }
      }
    } catch (err) {
      console.warn(
        `[Koios] ADA Handle batch ${Math.floor(i / HANDLE_BATCH_SIZE) + 1} failed:`,
        err,
      );
    }
  }

  return handleMap;
}

// ---------------------------------------------------------------------------
// SPO + CC Vote Bulk Fetch
// ---------------------------------------------------------------------------

/**
 * Bulk fetch all SPO votes from Koios /vote_list with voter_role=eq.SPO.
 * Returns votes keyed by pool_id.
 */
export async function fetchAllSPOVotesBulk(): Promise<SPOVote[]> {
  const allVotes: SPOVote[] = [];
  let offset = 0;
  let page = 0;

  while (true) {
    const url = `/vote_list?voter_role=eq.SPO&limit=${VOTE_LIST_PAGE_SIZE}&offset=${offset}`;
    const data = await koiosFetch<
      Array<{
        vote_tx_hash: string;
        voter_id: string;
        proposal_tx_hash: string;
        proposal_index: number;
        epoch_no: number;
        block_time: number;
        vote: 'Yes' | 'No' | 'Abstain';
      }>
    >(url, { cache: 'no-store' });

    const pageData = data || [];
    page++;

    for (const row of pageData) {
      allVotes.push({
        pool_id: row.voter_id,
        proposal_tx_hash: row.proposal_tx_hash,
        proposal_index: row.proposal_index,
        vote: row.vote,
        block_time: row.block_time,
        tx_hash: row.vote_tx_hash,
        epoch: row.epoch_no,
      });
    }

    console.log(
      `[Koios] SPO vote_list page ${page}: ${pageData.length} votes (total: ${allVotes.length})`,
    );

    if (pageData.length < VOTE_LIST_PAGE_SIZE) break;
    offset += VOTE_LIST_PAGE_SIZE;
  }

  return allVotes;
}

/**
 * Bulk fetch all Constitutional Committee votes from Koios /vote_list with voter_role=eq.CC.
 * Returns votes keyed by cc_hot_id.
 */
export async function fetchAllCCVotesBulk(): Promise<CCVote[]> {
  const allVotes: CCVote[] = [];
  let offset = 0;
  let page = 0;

  while (true) {
    const url = `/vote_list?voter_role=eq.CC&limit=${VOTE_LIST_PAGE_SIZE}&offset=${offset}`;
    const data = await koiosFetch<
      Array<{
        vote_tx_hash: string;
        voter_id: string;
        proposal_tx_hash: string;
        proposal_index: number;
        epoch_no: number;
        block_time: number;
        vote: 'Yes' | 'No' | 'Abstain';
      }>
    >(url, { cache: 'no-store' });

    const pageData = data || [];
    page++;

    for (const row of pageData) {
      allVotes.push({
        cc_hot_id: row.voter_id,
        proposal_tx_hash: row.proposal_tx_hash,
        proposal_index: row.proposal_index,
        vote: row.vote,
        block_time: row.block_time,
        tx_hash: row.vote_tx_hash,
        epoch: row.epoch_no,
      });
    }

    console.log(
      `[Koios] CC vote_list page ${page}: ${pageData.length} votes (total: ${allVotes.length})`,
    );

    if (pageData.length < VOTE_LIST_PAGE_SIZE) break;
    offset += VOTE_LIST_PAGE_SIZE;
  }

  return allVotes;
}

// ---------------------------------------------------------------------------
// Extended Account Info
// ---------------------------------------------------------------------------

/**
 * Fetch full account info for a stake address, including balance, rewards, and delegation.
 */
export async function fetchAccountInfo(stakeAddress: string): Promise<KoiosAccountInfo | null> {
  try {
    const data = await koiosFetch<
      Array<{
        stake_address?: string;
        status?: string;
        delegated_pool?: string;
        total_balance?: string;
        utxo?: string;
        rewards_available?: string;
        vote_delegation?: string;
        delegated_drep?: string;
      }>
    >('/account_info', {
      method: 'POST',
      body: JSON.stringify({ _stake_addresses: [stakeAddress] }),
    });

    const account = Array.isArray(data) ? data[0] : null;
    if (!account) return null;

    return {
      stake_address: account.stake_address || stakeAddress,
      status: account.status || 'unknown',
      delegated_pool: account.delegated_pool || null,
      total_balance: account.total_balance || '0',
      utxo: account.utxo || '0',
      rewards_available: account.rewards_available || '0',
      vote_delegation: account.vote_delegation || account.delegated_drep || null,
    };
  } catch (err) {
    console.error('[Koios] Error fetching account info:', err);
    return null;
  }
}
