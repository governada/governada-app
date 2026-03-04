/**
 * Governance Summary API
 * Lightweight endpoint for the homepage governance widget.
 * Returns open proposal stats and optional DRep accountability data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalPriority } from '@/utils/proposalPriority';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
    const supabase = createClient();
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    const { data: proposals, error } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, proposal_type, title, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, expiration_epoch',
      );

    if (error || !proposals) {
      return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
    }

    const openProposals = proposals.filter(
      (p: any) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
    );

    const openCount = openProposals.length;
    const criticalOpenCount = openProposals.filter(
      (p: any) => getProposalPriority(p.proposal_type) === 'critical',
    ).length;
    const importantOpenCount = openProposals.filter(
      (p: any) => getProposalPriority(p.proposal_type) === 'important',
    ).length;

    const result: Record<string, any> = {
      openCount,
      criticalOpenCount,
      importantOpenCount,
      currentEpoch,
    };

    if (drepId) {
      const openKeys = new Set(openProposals.map((p: any) => `${p.tx_hash}-${p.proposal_index}`));

      const { data: drepVotes } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index, vote, block_time')
        .eq('drep_id', drepId)
        .order('block_time', { ascending: false });

      const votedOnOpen = new Set<string>();
      const recentVotes: { title: string; vote: string; txHash: string; index: number }[] = [];

      if (drepVotes) {
        for (const v of drepVotes) {
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          if (openKeys.has(key)) {
            votedOnOpen.add(key);
          }
        }

        const seen = new Set<string>();
        for (const v of drepVotes) {
          const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const prop = proposals.find(
            (p: any) => p.tx_hash === v.proposal_tx_hash && p.proposal_index === v.proposal_index,
          );
          recentVotes.push({
            title: prop?.title || `Proposal ${v.proposal_tx_hash.slice(0, 8)}...`,
            vote: v.vote,
            txHash: v.proposal_tx_hash,
            index: v.proposal_index,
          });
          if (recentVotes.length >= 3) break;
        }
      }

      result.drepVotedCount = votedOnOpen.size;
      result.drepMissingCount = openCount - votedOnOpen.size;
      result.recentVotes = recentVotes;
    }

    return NextResponse.json(result);
});
