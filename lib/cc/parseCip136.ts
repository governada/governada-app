/**
 * CIP-136 rationale parser for Constitutional Committee votes.
 *
 * CIP-136 extends CIP-100 with structured fields specific to CC votes:
 * summary, rationaleStatement, precedentDiscussion, counterargumentDiscussion,
 * conclusion, internalVote, and RelevantArticles references.
 */

const FETCH_TIMEOUT_MS = 15_000;
const MAX_CONTENT_SIZE = 500_000; // 500KB

export interface CIP136Rationale {
  authorName: string | null;
  summary: string | null;
  rationaleStatement: string | null;
  precedentDiscussion: string | null;
  counterargumentDiscussion: string | null;
  conclusion: string | null;
  internalVote: InternalVote | null;
  citedArticles: string[];
  rawJson: Record<string, unknown>;
}

export interface InternalVote {
  constitutional: number;
  unconstitutional: number;
  abstain: number;
  didNotVote: number;
  againstVote: number;
}

/**
 * Fetch a CIP-136 rationale from a URL (HTTP or IPFS).
 * Returns null if fetch fails or content is not valid CIP-136.
 */
export async function fetchCip136Rationale(metaUrl: string): Promise<CIP136Rationale | null> {
  try {
    let url = metaUrl;
    if (url.startsWith('ipfs://')) {
      url = `https://ipfs.io/ipfs/${url.slice(7)}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, text/plain, */*' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) return null;

    const text = await response.text();
    if (text.length > MAX_CONTENT_SIZE) return null;

    const json = JSON.parse(text);
    return parseCip136(json);
  } catch {
    return null;
  }
}

/**
 * Parse a CIP-136 JSON document into structured fields.
 */
export function parseCip136(json: Record<string, unknown>): CIP136Rationale {
  const body = (json.body ?? {}) as Record<string, unknown>;
  const authors = json.authors as Array<{ name?: string }> | undefined;

  // Extract author name
  const authorName =
    (Array.isArray(authors) && authors.length > 0 && typeof authors[0]?.name === 'string'
      ? authors[0].name
      : null) ?? null;

  // Extract CIP-136 structured fields
  const summary = extractString(body.summary);
  const rationaleStatement = extractString(body.rationaleStatement);
  const precedentDiscussion = extractString(body.precedentDiscussion);
  const counterargumentDiscussion = extractString(body.counterargumentDiscussion);
  const conclusion = extractString(body.conclusion);

  // Parse internal vote — can be an object or an array with one object
  const rawIV = body.internalVote;
  let internalVote: InternalVote | null = null;
  const ivObj = Array.isArray(rawIV) ? rawIV[0] : rawIV;
  if (ivObj && typeof ivObj === 'object') {
    const iv = ivObj as Record<string, unknown>;
    internalVote = {
      constitutional: toNum(iv.constitutional),
      unconstitutional: toNum(iv.unconstitutional),
      abstain: toNum(iv.abstain),
      didNotVote: toNum(iv.didNotVote),
      againstVote: toNum(iv.againstVote),
    };
  }

  // Extract cited constitutional articles from references
  const references = (body.references ?? []) as Array<Record<string, unknown>>;
  const citedArticles: string[] = [];
  for (const ref of references) {
    if (ref['@type'] === 'RelevantArticles' && typeof ref.label === 'string') {
      citedArticles.push(ref.label);
    }
  }

  // Fallback: extract article citations from rationale text
  if (citedArticles.length === 0 && rationaleStatement) {
    const articlePattern =
      /Article\s+[IVX]+(?:,?\s*(?:§|Section)\s*\d+(?:\.\d+)?)?|Art\.\s*[IVX\d]+|Article\s+(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|Appendix\s+[IVX\d]+|Preamble|§\s*\d+/g;
    const matches = rationaleStatement.match(articlePattern);
    if (matches) {
      for (const m of [...new Set(matches)]) {
        citedArticles.push(m);
      }
    }
  }

  return {
    authorName,
    summary,
    rationaleStatement,
    precedentDiscussion,
    counterargumentDiscussion,
    conclusion,
    internalVote,
    citedArticles,
    rawJson: json,
  };
}

function extractString(val: unknown): string | null {
  if (typeof val === 'string' && val.trim()) return val.trim();
  if (val && typeof val === 'object' && '@value' in (val as Record<string, unknown>)) {
    const v = (val as Record<string, unknown>)['@value'];
    if (typeof v === 'string') return v.trim() || null;
  }
  return null;
}

function toNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseInt(val, 10) || 0;
  return 0;
}
