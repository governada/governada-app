/**
 * Reviewer Briefing Cache API
 *
 * GET /api/workspace/reviewer-cache?voterId=<id>&txHash=<hash>&index=<num>
 *
 * Returns cached personalized briefing for a specific voter + proposal,
 * or null if not cached.
 *
 * POST /api/workspace/reviewer-cache
 * Body: { voterId, txHash, index, content, voterContextHash? }
 *
 * Stores a personalized briefing result for future reads (write-through cache).
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const voterId = url.searchParams.get('voterId');
  const txHash = url.searchParams.get('txHash');
  const indexStr = url.searchParams.get('index');

  if (!voterId || !txHash || indexStr == null) {
    return NextResponse.json({ error: 'Missing voterId, txHash, or index' }, { status: 400 });
  }

  const proposalIndex = parseInt(indexStr, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('reviewer_briefing_cache')
      .select('content, voter_context_hash, updated_at')
      .eq('voter_id', voterId)
      .eq('proposal_tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .maybeSingle();

    if (error) {
      logger.error('[reviewer-cache] Query error', { error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      ...data.content,
      cachedAt: data.updated_at,
    });
  } catch (err) {
    logger.error('[reviewer-cache] Unexpected error', { error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { voterId, txHash, index, content, voterContextHash } = body;

    if (!voterId || !txHash || index == null || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('reviewer_briefing_cache').upsert(
      {
        voter_id: voterId,
        proposal_tx_hash: txHash,
        proposal_index: index,
        content,
        voter_context_hash: voterContextHash ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'voter_id,proposal_tx_hash,proposal_index' },
    );

    if (error) {
      logger.error('[reviewer-cache] Upsert error', { error });
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[reviewer-cache] Unexpected error', { error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
