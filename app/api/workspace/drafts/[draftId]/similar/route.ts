/**
 * Proposal Similarity Search API — find existing on-chain proposals similar
 * to a draft's content using semantic embeddings.
 *
 * GET /api/workspace/drafts/[draftId]/similar?stakeAddress=...
 *
 * Approach:
 *  1. Compose draft text (title + abstract + motivation + rationale)
 *  2. Generate an embedding via OpenAI text-embedding-3-large
 *  3. Use the `match_embeddings` RPC to find similar on-chain proposals
 *  4. Enrich with proposal metadata (title, type, status)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { semanticSearch } from '@/lib/embeddings';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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

export interface SimilarProposalResponse {
  txHash: string;
  proposalIndex: number;
  title: string;
  abstract: string | null;
  proposalType: string;
  similarity: number;
  status: string;
}

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    // Extract draftId from URL path
    const pathSegments = request.nextUrl.pathname.split('/');
    const similarIdx = pathSegments.indexOf('similar');
    const draftId = similarIdx > 0 ? pathSegments[similarIdx - 1] : null;

    if (!draftId) {
      return NextResponse.json({ error: 'Missing draftId' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch draft content
    const { data: draft, error: draftError } = await admin
      .from('proposal_drafts')
      .select('id, title, abstract, motivation, rationale')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Build search text from draft content
    const parts = [draft.title, draft.abstract, draft.motivation, draft.rationale].filter(
      (p): p is string => !!p && p.trim().length > 0,
    );

    if (parts.length === 0) {
      return NextResponse.json({ similar: [] });
    }

    const searchText = parts
      .map((p, i) => {
        const labels = ['Title', 'Abstract', 'Motivation', 'Rationale'];
        return `${labels[i]}: ${p}`;
      })
      .join('\n\n');

    try {
      // Use the existing semantic search infrastructure
      // This generates an embedding for the text and queries match_embeddings RPC
      const results = await semanticSearch(searchText, 'proposal', {
        threshold: 0.5,
        limit: 5,
      });

      if (results.length === 0) {
        return NextResponse.json({ similar: [] });
      }

      // The entity_id for proposals is stored as "txHash:index"
      const entityIds = results.map((r) => r.entity_id);
      const txHashPairs = entityIds.map((id) => {
        const [txHash, index] = id.split(':');
        return { txHash, index: parseInt(index, 10) };
      });

      // Fetch proposal details for enrichment
      const { data: proposals } = await admin
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

      const similar: SimilarProposalResponse[] = results
        .map((r) => {
          const proposal = proposalMap.get(r.entity_id);
          if (!proposal) return null;

          return {
            txHash: proposal.tx_hash,
            proposalIndex: proposal.proposal_index,
            title: proposal.title ?? 'Untitled',
            abstract: proposal.abstract,
            proposalType: proposal.proposal_type,
            similarity: Math.round(r.similarity * 100) / 100,
            status: deriveProposalStatus(proposal),
          };
        })
        .filter((p): p is SimilarProposalResponse => p !== null);

      return NextResponse.json({ similar });
    } catch (err) {
      logger.error('[similar] Semantic search failed', { error: err, draftId });

      // If embedding fails (e.g., no OpenAI key), return empty rather than 500
      return NextResponse.json({ similar: [] });
    }
  },
  { auth: 'optional', rateLimit: { max: 20, window: 60 } },
);
