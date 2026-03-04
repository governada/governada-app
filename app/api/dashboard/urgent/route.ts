import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getOpenProposalsForDRep } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalDisplayTitle } from '@/utils/display';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  const pendingProposals = await getOpenProposalsForDRep(drepId);
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  const urgent = pendingProposals
    .filter((p: any) => {
      const expiryEpoch = p.expiration ?? p.proposal_expiry_epoch ?? 0;
      return expiryEpoch > 0 && expiryEpoch - currentEpoch <= 2;
    })
    .map((p: any) => {
      const expiryEpoch = p.expiration ?? p.proposal_expiry_epoch ?? 0;
      return {
        txHash: p.proposal_tx_hash,
        index: p.proposal_index,
        title: getProposalDisplayTitle(p.title, p.proposal_tx_hash, p.proposal_index),
        proposalType: p.proposal_type || 'Proposal',
        epochsRemaining: Math.max(0, expiryEpoch - currentEpoch),
      };
    })
    .sort((a: any, b: any) => a.epochsRemaining - b.epochsRemaining);

  let unexplainedVotes: { txHash: string; index: number; title: string }[] = [];
  try {
    const supabase = createClient();
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

    const { data: recentVotes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index')
      .eq('drep_id', drepId)
      .gte('created_at', twoDaysAgo)
      .limit(10);

    if (recentVotes && recentVotes.length > 0) {
      const { data: explanations } = await supabase
        .from('vote_explanations')
        .select('proposal_tx_hash, proposal_index')
        .eq('drep_id', drepId);

      const explainedSet = new Set(
        (explanations ?? []).map((e) => `${e.proposal_tx_hash}-${e.proposal_index}`),
      );

      const unexplained = recentVotes.filter(
        (v) => !explainedSet.has(`${v.proposal_tx_hash}-${v.proposal_index}`),
      );

      if (unexplained.length > 0) {
        const proposalKeys = unexplained.map((v) => v.proposal_tx_hash);
        const { data: proposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title')
          .in('tx_hash', proposalKeys);

        const proposalTitleMap = new Map(
          (proposals ?? []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p.title]),
        );

        unexplainedVotes = unexplained.map((v) => ({
          txHash: v.proposal_tx_hash,
          index: v.proposal_index,
          title:
            proposalTitleMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`) ||
            'Untitled Proposal',
        }));
      }
    }
  } catch (err) {
    logger.error('Unexplained votes check failed', { context: 'dashboard/urgent', error: err });
  }

  return NextResponse.json({ proposals: urgent, unexplainedVotes });
});
