export const RATIONALE_FETCH_STATUS = {
  pending: 'pending',
  retry: 'retry',
  fetched: 'fetched',
  inline: 'inline',
  failed: 'failed',
} as const;

export type RationaleFetchStatus =
  (typeof RATIONALE_FETCH_STATUS)[keyof typeof RATIONALE_FETCH_STATUS];

export const RATIONALE_FETCH_MAX_ATTEMPTS = 6;

export interface StoredVoteRationaleRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  meta_url: string | null;
  rationale_text: string | null;
  fetched_at: string | null;
  fetch_status: RationaleFetchStatus;
  fetch_attempts: number;
  fetch_last_attempted_at: string | null;
  fetch_last_error: string | null;
  next_fetch_at: string | null;
  ai_summary?: string | null;
  hash_verified?: boolean | null;
  hash_check_attempted_at?: string | null;
}

export interface ExistingVoteRationaleRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string | null;
  proposal_index: number | null;
  meta_url: string | null;
  rationale_text: string | null;
  fetched_at: string | null;
  fetch_status: RationaleFetchStatus | null;
  fetch_attempts: number | null;
  fetch_last_attempted_at: string | null;
  fetch_last_error: string | null;
  next_fetch_at: string | null;
}

export type PlannedVoteRationaleUpsert = StoredVoteRationaleRow;

export type RationaleFetchOutcome =
  | {
      ok: true;
      rationaleText: string;
    }
  | {
      ok: false;
      retryable: boolean;
      reason: string;
    };

const RATIONALE_FETCH_TIMEOUT_MS = 5000;
const RATIONALE_MAX_CONTENT_SIZE = 50_000;

function extractJsonLdString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (value && typeof value === 'object' && '@value' in (value as Record<string, unknown>)) {
    const inner = (value as Record<string, unknown>)['@value'];
    return typeof inner === 'string' ? inner.trim() || null : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractJsonLdString(item);
      if (extracted) return extracted;
    }
  }
  return null;
}

function normalizeFetchUrl(url: string): string {
  if (url.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`;
  }
  return url;
}

function extractRationaleFromRawText(text: string): string | null {
  if (text.length > RATIONALE_MAX_CONTENT_SIZE) {
    return null;
  }

  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object' && 'body' in json && typeof json.body === 'object') {
      for (const key of ['comment', 'rationale', 'motivation']) {
        const extracted = extractJsonLdString(json.body[key]);
        if (extracted) return extracted;
      }
    }

    if (json && typeof json === 'object') {
      for (const key of ['rationale', 'motivation', 'justification', 'reason', 'comment']) {
        const extracted = extractJsonLdString(json[key]);
        if (extracted) return extracted;
      }
    }

    if (typeof json === 'string' && json.trim()) {
      return json.trim();
    }
  } catch {
    if (text.trim() && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
      return text.trim();
    }
  }

  return null;
}

export function hasRationaleText(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.trim().length > 0;
}

export function isSuccessfulRationaleStatus(
  status: RationaleFetchStatus | null | undefined,
): boolean {
  return status === RATIONALE_FETCH_STATUS.inline || status === RATIONALE_FETCH_STATUS.fetched;
}

export function getNextRationaleRetryAt(attempts: number, now: Date = new Date()): string {
  const backoffHours = Math.min(24 * 7, 2 ** Math.max(0, attempts - 1));
  return new Date(now.getTime() + backoffHours * 60 * 60 * 1000).toISOString();
}

export function planVoteRationaleUpserts(
  incomingRows: StoredVoteRationaleRow[],
  existingRows: Map<string, ExistingVoteRationaleRow>,
): PlannedVoteRationaleUpsert[] {
  const planned: PlannedVoteRationaleUpsert[] = [];

  for (const incoming of incomingRows) {
    const existing = existingRows.get(incoming.vote_tx_hash);

    if (incoming.fetch_status === RATIONALE_FETCH_STATUS.inline) {
      planned.push({
        ...incoming,
        fetch_attempts: existing?.fetch_attempts ?? incoming.fetch_attempts,
        fetch_last_attempted_at: existing?.fetch_last_attempted_at ?? null,
        fetch_last_error: null,
        next_fetch_at: null,
      });
      continue;
    }

    if (!existing) {
      planned.push(incoming);
      continue;
    }

    const metaUrlChanged = (existing.meta_url ?? null) !== (incoming.meta_url ?? null);
    if (metaUrlChanged) {
      planned.push({
        ...incoming,
        rationale_text: null,
        fetched_at: null,
        fetch_status: RATIONALE_FETCH_STATUS.pending,
        fetch_attempts: 0,
        fetch_last_attempted_at: null,
        fetch_last_error: null,
        next_fetch_at: incoming.next_fetch_at,
        ai_summary: null,
        hash_verified: null,
        hash_check_attempted_at: null,
      });
      continue;
    }

    if (!existing.fetch_status && !hasRationaleText(existing.rationale_text)) {
      planned.push({
        ...incoming,
        fetch_attempts: existing.fetch_attempts ?? incoming.fetch_attempts,
        fetch_last_attempted_at: existing.fetch_last_attempted_at,
        fetch_last_error: existing.fetch_last_error,
        next_fetch_at: existing.next_fetch_at ?? incoming.next_fetch_at,
      });
      continue;
    }
  }

  return planned;
}

export async function fetchRationaleTextFromUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RationaleFetchOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RATIONALE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(normalizeFetchUrl(url), {
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain, */*' },
    });

    if (!response.ok) {
      const retryable =
        response.status === 408 || response.status === 429 || response.status >= 500;
      return {
        ok: false,
        retryable,
        reason: `http_${response.status}`,
      };
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > RATIONALE_MAX_CONTENT_SIZE) {
      return { ok: false, retryable: false, reason: 'content_too_large' };
    }

    const text = await response.text();
    if (text.length > RATIONALE_MAX_CONTENT_SIZE) {
      return { ok: false, retryable: false, reason: 'content_too_large' };
    }

    const rationaleText = extractRationaleFromRawText(text);
    if (!rationaleText) {
      return { ok: false, retryable: false, reason: 'invalid_content' };
    }

    return { ok: true, rationaleText };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error';
    return { ok: false, retryable: true, reason };
  } finally {
    clearTimeout(timeoutId);
  }
}
