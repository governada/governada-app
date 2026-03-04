/**
 * DRep Votes API
 * Returns a DRep's vote choices keyed by proposal for client-side indicators.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.pathname.split('/api/drep/')[1]?.split('/')[0];
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: votes, error } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('drep_id', drepId);

  if (error) {
    logger.error('Failed to fetch DRep votes', {
      context: 'drep/votes',
      drepId,
      error: error.message,
      requestId,
    });
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
  }

  return NextResponse.json({
    votes: (votes || []).map((v: any) => ({
      proposalTxHash: v.proposal_tx_hash,
      proposalIndex: v.proposal_index,
      vote: v.vote,
    })),
  });
});
