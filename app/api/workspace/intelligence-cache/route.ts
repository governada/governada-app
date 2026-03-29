/**
 * Intelligence Cache API
 *
 * GET /api/workspace/intelligence-cache?txHash=<hash>&index=<num>
 *
 * Returns all cached intelligence sections for a proposal.
 * Sections not yet cached return null.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const txHash = url.searchParams.get('txHash');
  const indexStr = url.searchParams.get('index');

  if (!txHash || indexStr == null) {
    return NextResponse.json({ error: 'Missing txHash or index' }, { status: 400 });
  }

  const proposalIndex = parseInt(indexStr, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('proposal_intelligence_cache')
      .select('section_type, content, updated_at')
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex);

    if (error) {
      logger.error('[intelligence-cache] Query error', { error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Build response keyed by section type
    const result: Record<string, unknown> = {
      constitutional: null,
      key_questions: null,
      passage_prediction: null,
    };

    for (const row of data ?? []) {
      result[row.section_type] = {
        ...row.content,
        cachedAt: row.updated_at,
      };
    }

    return NextResponse.json(result);
  } catch (err) {
    logger.error('[intelligence-cache] Unexpected error', { error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
