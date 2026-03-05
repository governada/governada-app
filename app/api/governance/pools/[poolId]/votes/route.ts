import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/governance/pools/:poolId/votes
 * Returns paginated governance vote history for a pool.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const poolId = request.nextUrl.pathname.split('/pools/')[1]?.split('/')[0];
  if (!poolId) return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });

  const limit = Math.min(100, parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10));

  const supabase = createClient();

  const { data: voteRows } = await supabase
    .from('spo_votes')
    .select('pool_id, proposal_tx_hash, proposal_index, vote, block_time, epoch')
    .eq('pool_id', poolId)
    .order('block_time', { ascending: false })
    .limit(limit);

  if (!voteRows?.length) {
    return NextResponse.json({ votes: [], totalVotes: 0 });
  }

  const txHashes = [...new Set(voteRows.map((v) => v.proposal_tx_hash))];
  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type')
    .in('tx_hash', txHashes);

  const proposalMap = new Map(
    (proposals ?? []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]),
  );

  const votes = voteRows.map((v) => {
    const proposal = proposalMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`);
    return {
      proposalTxHash: v.proposal_tx_hash,
      proposalIndex: v.proposal_index,
      vote: v.vote,
      blockTime: v.block_time,
      epoch: v.epoch,
      proposalTitle: proposal?.title ?? null,
      proposalType: proposal?.proposal_type ?? null,
    };
  });

  const { count: totalVotes } = await supabase
    .from('spo_votes')
    .select('pool_id', { count: 'exact', head: true })
    .eq('pool_id', poolId);

  return NextResponse.json(
    { votes, totalVotes: totalVotes ?? votes.length },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=120' } },
  );
});
