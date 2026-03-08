/**
 * GET /api/engagement/citizen-voice
 *
 * Returns a citizen's engagement activity for an epoch plus outcomes:
 *   - Which proposals they voted on (sentiment)
 *   - Community consensus on each
 *   - Their DRep's vote alignment
 *   - Proposal outcome (ratified/dropped/expired/active)
 *
 * Query params:
 *   - epoch (optional, defaults to current)
 *   - wallet (optional, used to resolve DRep)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

export const dynamic = 'force-dynamic';

interface VoiceProposal {
  txHash: string;
  index: number;
  title: string | null;
  proposalType: string | null;
  userSentiment: string;
  communitySupport: number;
  communityTotal: number;
  communityAgreement: number | null;
  drepVote: string | null;
  drepAligned: boolean | null;
  outcome: string;
}

export const GET = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const epochParam = request.nextUrl.searchParams.get('epoch');
    const walletParam = request.nextUrl.searchParams.get('wallet');

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const epoch = epochParam ? parseInt(epochParam, 10) : currentEpoch;

    if (!ctx.userId) {
      return NextResponse.json({
        proposals: [],
        summary: null,
      });
    }

    // 1. Get user's sentiment votes
    const { data: sentiments } = await supabase
      .from('citizen_sentiment')
      .select('proposal_tx_hash, proposal_index, sentiment, delegated_drep_id, updated_at')
      .eq('user_id', ctx.userId);

    if (!sentiments || sentiments.length === 0) {
      return NextResponse.json({
        proposals: [],
        summary: { totalVotes: 0, epoch },
      });
    }

    // 2. Get proposal details for all user-voted proposals
    const proposalKeys = sentiments.map((s) => `${s.proposal_tx_hash}`);
    const uniqueTxHashes = [...new Set(proposalKeys)];

    const { data: proposals } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, title, proposal_type, ratified_epoch, expired_epoch, dropped_epoch, proposed_epoch',
      )
      .in('tx_hash', uniqueTxHashes);

    const proposalMap = new Map<
      string,
      {
        title: string | null;
        proposal_type: string | null;
        ratified_epoch: number | null;
        expired_epoch: number | null;
        dropped_epoch: number | null;
        proposed_epoch: number | null;
      }
    >();
    for (const p of proposals || []) {
      proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, {
        title: p.title,
        proposal_type: p.proposal_type,
        ratified_epoch: p.ratified_epoch,
        expired_epoch: p.expired_epoch,
        dropped_epoch: p.dropped_epoch,
        proposed_epoch: p.proposed_epoch,
      });
    }

    // 3. Get community aggregations for these proposals
    const entityIds = sentiments.map((s) => `${s.proposal_tx_hash}:${s.proposal_index}`);
    const { data: aggregations } = await supabase
      .from('engagement_signal_aggregations')
      .select('entity_id, data')
      .eq('entity_type', 'proposal')
      .eq('signal_type', 'sentiment')
      .in('entity_id', entityIds);

    const aggMap = new Map<
      string,
      { support: number; oppose: number; unsure: number; total: number }
    >();
    for (const a of aggregations || []) {
      aggMap.set(
        a.entity_id,
        a.data as { support: number; oppose: number; unsure: number; total: number },
      );
    }

    // 4. Resolve DRep ID for vote alignment check
    let drepId: string | null = null;
    if (walletParam || ctx.wallet) {
      const address = walletParam || ctx.wallet;
      const { data: walletRow } = await supabase
        .from('user_wallets')
        .select('drep_id')
        .eq('payment_address', address!)
        .maybeSingle();
      drepId = walletRow?.drep_id ?? null;
    }

    // 5. Get DRep votes for alignment check
    const drepVoteMap = new Map<string, string>();
    if (drepId) {
      const { data: drepVotes } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash, proposal_index, vote')
        .eq('drep_id', drepId);

      for (const v of drepVotes || []) {
        drepVoteMap.set(`${v.proposal_tx_hash}:${v.proposal_index}`, v.vote);
      }
    }

    // 6. Build response
    const voiceProposals: VoiceProposal[] = [];

    for (const s of sentiments) {
      const key = `${s.proposal_tx_hash}:${s.proposal_index}`;
      const proposal = proposalMap.get(key);
      const communityData = aggMap.get(key);
      const drepVote = drepVoteMap.get(key) ?? null;

      // Determine outcome
      let outcome = 'active';
      if (proposal?.ratified_epoch != null) outcome = 'ratified';
      else if (proposal?.expired_epoch != null) outcome = 'expired';
      else if (proposal?.dropped_epoch != null) outcome = 'dropped';

      // Community agreement with user's sentiment
      let communityAgreement: number | null = null;
      if (communityData && communityData.total > 0) {
        const matchingSentiment =
          s.sentiment === 'support'
            ? communityData.support
            : s.sentiment === 'oppose'
              ? communityData.oppose
              : communityData.unsure;
        communityAgreement = Math.round((matchingSentiment / communityData.total) * 100);
      }

      // DRep alignment: support->Yes, oppose->No
      let drepAligned: boolean | null = null;
      if (drepVote && s.sentiment !== 'unsure') {
        const sentimentToVote: Record<string, string> = {
          support: 'Yes',
          oppose: 'No',
        };
        drepAligned = drepVote === sentimentToVote[s.sentiment];
      }

      voiceProposals.push({
        txHash: s.proposal_tx_hash,
        index: s.proposal_index,
        title: proposal?.title ?? null,
        proposalType: proposal?.proposal_type ?? null,
        userSentiment: s.sentiment,
        communitySupport: communityData?.support ?? 0,
        communityTotal: communityData?.total ?? 0,
        communityAgreement,
        drepVote,
        drepAligned,
        outcome,
      });
    }

    // Sort: most recent first (by update time), limit to current/recent epoch
    voiceProposals.sort((a, b) => {
      // Resolved proposals first, then active
      const outcomeOrder: Record<string, number> = {
        ratified: 0,
        dropped: 1,
        expired: 2,
        active: 3,
      };
      return (outcomeOrder[a.outcome] ?? 4) - (outcomeOrder[b.outcome] ?? 4);
    });

    // Compute summary
    const totalVotes = voiceProposals.length;
    const sentimentBreakdown = {
      support: voiceProposals.filter((p) => p.userSentiment === 'support').length,
      oppose: voiceProposals.filter((p) => p.userSentiment === 'oppose').length,
      unsure: voiceProposals.filter((p) => p.userSentiment === 'unsure').length,
    };
    const withCommunityData = voiceProposals.filter((p) => p.communityAgreement != null);
    const avgAgreement =
      withCommunityData.length > 0
        ? Math.round(
            withCommunityData.reduce((sum, p) => sum + (p.communityAgreement ?? 0), 0) /
              withCommunityData.length,
          )
        : null;
    const drepAlignedCount = voiceProposals.filter((p) => p.drepAligned === true).length;
    const drepDivergedCount = voiceProposals.filter((p) => p.drepAligned === false).length;

    return NextResponse.json(
      {
        proposals: voiceProposals.slice(0, 10),
        summary: {
          totalVotes,
          sentimentBreakdown,
          avgCommunityAgreement: avgAgreement,
          drepAligned: drepAlignedCount,
          drepDiverged: drepDivergedCount,
          epoch,
        },
      },
      {
        headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300' },
      },
    );
  },
  { auth: 'optional' },
);
