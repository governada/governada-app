/**
 * GET /api/intelligence/search
 *
 * Semantic search across governance entities for the Seneca companion.
 * Searches proposals and DRep profiles using vector similarity,
 * then enriches results with entity metadata from Supabase.
 *
 * Query params:
 *   q     — search text (required)
 *   type  — entity type filter: "proposal" | "drep_profile" | "all" (default: "all")
 *   limit — max results (default: 8, max: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { semanticSearch } from '@/lib/embeddings';
import type { SemanticSearchResult } from '@/lib/embeddings';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_TYPES = ['proposal', 'drep_profile', 'all'] as const;
type SearchType = (typeof VALID_TYPES)[number];

interface DRepRowInfo {
  name?: string | null;
  votingPower?: number;
  [key: string]: unknown;
}

/** Derive a human-readable status from epoch columns. */
function deriveProposalStatus(row: {
  ratified_epoch: number | null;
  enacted_epoch: number | null;
  dropped_epoch: number | null;
  expired_epoch: number | null;
}): string {
  if (row.enacted_epoch != null) return 'Enacted';
  if (row.ratified_epoch != null) return 'Ratified';
  if (row.dropped_epoch != null) return 'Dropped';
  if (row.expired_epoch != null) return 'Expired';
  return 'In Voting';
}

/** Enrich proposal search results with metadata from the proposals table. */
async function enrichProposals(
  results: SemanticSearchResult[],
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  if (results.length === 0) return [];

  // entity_id for proposals is stored as "txHash:index"
  const txHashPairs = results.map((r) => {
    const [txHash, index] = r.entity_id.split(':');
    return { txHash, index: parseInt(index, 10) };
  });

  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, abstract, proposal_type, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch',
    )
    .in(
      'tx_hash',
      txHashPairs.map((p) => p.txHash),
    );

  const proposalMap = new Map(
    (proposals ?? []).map((p) => [`${p.tx_hash}:${p.proposal_index}`, p]),
  );

  return results
    .map((r) => {
      const proposal = proposalMap.get(r.entity_id);
      if (!proposal) return null;

      return {
        entityType: 'proposal' as const,
        entityId: r.entity_id,
        similarity: Math.round(r.similarity * 100) / 100,
        title: proposal.title ?? 'Untitled',
        abstract: proposal.abstract ?? null,
        proposalType: proposal.proposal_type,
        status: deriveProposalStatus(proposal),
        href: `/governance/proposals/${proposal.tx_hash}-${proposal.proposal_index}`,
      };
    })
    .filter(Boolean);
}

/** Enrich DRep profile search results with metadata from the dreps table. */
async function enrichDreps(
  results: SemanticSearchResult[],
  supabase: ReturnType<typeof getSupabaseAdmin>,
) {
  if (results.length === 0) return [];

  const drepIds = results.map((r) => r.entity_id);

  const { data: dreps } = await supabase.from('dreps').select('id, info, score').in('id', drepIds);

  const drepMap = new Map((dreps ?? []).map((d) => [d.id, d]));

  return results
    .map((r) => {
      const drep = drepMap.get(r.entity_id);
      if (!drep) return null;

      const info = (drep.info as DRepRowInfo | null) ?? {};
      return {
        entityType: 'drep_profile' as const,
        entityId: r.entity_id,
        similarity: Math.round(r.similarity * 100) / 100,
        title: info.name ?? r.entity_id.slice(0, 16) + '...',
        votingPower: info.votingPower ?? null,
        overallScore: drep.score ?? null,
        href: `/governance/dreps/${r.entity_id}`,
      };
    })
    .filter(Boolean);
}

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q')?.trim();
    const typeParam = (searchParams.get('type') ?? 'all') as SearchType;
    const limitParam = searchParams.get('limit');

    // Validate query
    if (!query || query.length === 0) {
      return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
    }
    if (query.length > 500) {
      return NextResponse.json({ error: 'Query too long (max 500 characters)' }, { status: 400 });
    }

    // Validate type
    if (!VALID_TYPES.includes(typeParam)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate limit
    const limit = Math.min(Math.max(parseInt(limitParam ?? '8', 10) || 8, 1), 20);

    const supabase = getSupabaseAdmin();

    try {
      const searchTypes: ('proposal' | 'drep_profile')[] =
        typeParam === 'all'
          ? ['proposal', 'drep_profile']
          : [typeParam as 'proposal' | 'drep_profile'];

      // Run searches in parallel for "all" mode
      const searchPromises = searchTypes.map((entityType) =>
        semanticSearch(query, entityType, {
          threshold: 0.4,
          limit: typeParam === 'all' ? Math.ceil(limit * 0.75) : limit,
        }),
      );

      const searchResults = await Promise.all(searchPromises);

      // Separate results by type for enrichment
      const proposalResults = searchTypes.includes('proposal')
        ? (searchResults[searchTypes.indexOf('proposal')] ?? [])
        : [];
      const drepResults = searchTypes.includes('drep_profile')
        ? (searchResults[searchTypes.indexOf('drep_profile')] ?? [])
        : [];

      // Enrich in parallel
      const [enrichedProposals, enrichedDreps] = await Promise.all([
        enrichProposals(proposalResults, supabase),
        enrichDreps(drepResults, supabase),
      ]);

      // Merge and sort by similarity descending, then truncate to limit
      const results = [...enrichedProposals, ...enrichedDreps]
        .sort((a, b) => (b?.similarity ?? 0) - (a?.similarity ?? 0))
        .slice(0, limit);

      return NextResponse.json(
        { results, query },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        },
      );
    } catch (err) {
      logger.error('[intelligence/search] Semantic search failed', { error: err, query });

      // If embedding generation fails (e.g., no OpenAI key), return empty rather than 500
      return NextResponse.json({ results: [], query });
    }
  },
  { auth: 'none', rateLimit: { max: 30, window: 60 } },
);
