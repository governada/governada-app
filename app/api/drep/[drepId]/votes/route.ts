/**
 * DRep Votes API
 * Returns a DRep's vote history enriched with proposal titles, type, epoch, and rationale status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { getProposalDisplayTitle } from '@/utils/display';
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
    .select('proposal_tx_hash, proposal_index, vote, epoch_no, block_time, rationale_quality')
    .eq('drep_id', drepId)
    .order('block_time', { ascending: false });

  if (error) {
    logger.error('Failed to fetch DRep votes', {
      context: 'drep/votes',
      drepId,
      error: error.message,
      requestId,
    });
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 });
  }

  const allVotes = votes || [];
  const txHashes = [...new Set(allVotes.map((v) => v.proposal_tx_hash))];

  const [proposalsResult, rationalesResult] = await Promise.all([
    txHashes.length > 0
      ? supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title, proposal_type')
          .in('tx_hash', txHashes)
      : Promise.resolve({ data: [] }),
    supabase
      .from('vote_rationales')
      .select('proposal_tx_hash, proposal_index')
      .eq('drep_id', drepId)
      .not('rationale_text', 'is', null),
  ]);

  const proposalMap = new Map(
    (proposalsResult.data ?? []).map((p: any) => [
      `${p.tx_hash}:${p.proposal_index}`,
      { title: p.title, proposalType: p.proposal_type },
    ]),
  );

  const rationaleSet = new Set(
    (rationalesResult.data ?? []).map((r: any) => `${r.proposal_tx_hash}:${r.proposal_index}`),
  );

  return NextResponse.json({
    votes: allVotes.map((v: any) => {
      const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
      const proposal = proposalMap.get(key);
      return {
        proposalTxHash: v.proposal_tx_hash,
        proposalIndex: v.proposal_index,
        vote: v.vote,
        epochNo: v.epoch_no,
        proposalTitle: proposal
          ? getProposalDisplayTitle(proposal.title, v.proposal_tx_hash, v.proposal_index)
          : null,
        proposalType: proposal?.proposalType ?? null,
        hasRationale:
          rationaleSet.has(key) || (v.rationale_quality != null && v.rationale_quality > 0),
      };
    }),
  });
});
