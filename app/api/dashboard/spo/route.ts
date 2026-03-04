/**
 * SPO Dashboard API
 * Returns a pool's full governance participation data: votes, pending proposals,
 * and alignment stats for the SPO dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const poolId = request.nextUrl.searchParams.get('poolId');
  if (!poolId) {
    return NextResponse.json({ error: 'poolId required' }, { status: 400 });
  }

  const supabase = createClient();

  const [votesResult, totalResult] = await Promise.all([
    supabase
      .from('spo_votes')
      .select('pool_id, proposal_tx_hash, proposal_index, vote, block_time, epoch')
      .eq('pool_id', poolId)
      .order('block_time', { ascending: false }),
    supabase.from('proposals').select('tx_hash', { count: 'exact', head: true }),
  ]);

  const votes = votesResult.data ?? [];
  const totalProposals = totalResult.count ?? 0;

  if (votes.length === 0) {
    return NextResponse.json({
      poolId,
      votes: [],
      totalProposals,
      participationRate: 0,
      yesCount: 0,
      noCount: 0,
      abstainCount: 0,
      pendingProposals: [],
    });
  }

  const txHashes = [...new Set(votes.map((v) => v.proposal_tx_hash))];
  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type')
    .in('tx_hash', txHashes);

  const proposalMap = new Map(
    (proposals ?? []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]),
  );

  const { data: openProposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, proposal_type, expiration_epoch')
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null);

  const votedKeys = new Set(votes.map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`));
  const pendingProposals = (openProposals ?? []).filter(
    (p) => !votedKeys.has(`${p.tx_hash}-${p.proposal_index}`),
  );

  const enrichedVotes = votes.map((v) => {
    const proposal = proposalMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`);
    return {
      ...v,
      proposalTitle: proposal?.title ?? null,
      proposalType: proposal?.proposal_type ?? null,
    };
  });

  const yesCount = votes.filter((v) => v.vote === 'Yes').length;
  const noCount = votes.filter((v) => v.vote === 'No').length;
  const abstainCount = votes.filter((v) => v.vote === 'Abstain').length;

  captureServerEvent(
    'spo_dashboard_api_served',
    {
      poolId,
      voteCount: votes.length,
      participationRate: totalProposals ? Math.round((votes.length / totalProposals) * 100) : 0,
      pendingCount: pendingProposals.length,
    },
    poolId,
  );

  return NextResponse.json({
    poolId,
    votes: enrichedVotes,
    totalProposals,
    participationRate: totalProposals ? Math.round((votes.length / totalProposals) * 100) : 0,
    yesCount,
    noCount,
    abstainCount,
    pendingProposals,
  });
});
