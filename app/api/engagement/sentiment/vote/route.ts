import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { SentimentVoteSchema } from '@/lib/api/schemas/engagement';
import { aggregateSentiment } from '@/lib/api/engagement-utils';
import { fetchDelegatedDRep } from '@/utils/koios';
import { checkEpochRateLimit } from '@/lib/api/epochRateLimit';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const walletAddress = wallet!;
    const { proposalTxHash, proposalIndex, sentiment, stakeAddress, delegatedDrepId } =
      SentimentVoteSchema.parse(await request.json());

    const resolvedStakeAddress = stakeAddress || null;
    let resolvedDrepId = delegatedDrepId || null;

    if (!resolvedDrepId && resolvedStakeAddress) {
      resolvedDrepId = await fetchDelegatedDRep(resolvedStakeAddress);
    }

    // Per-epoch rate limit (50 sentiment votes per epoch)
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const epochRL = await checkEpochRateLimit({
      action: 'sentiment',
      userId: userId!,
      epoch: currentEpoch,
    });
    if (!epochRL.allowed) {
      return NextResponse.json(
        { error: `Sentiment vote limit reached for this epoch (${epochRL.limit} max)` },
        { status: 429 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existing } = await supabase
      .from('citizen_sentiment')
      .select('id')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex)
      .eq('user_id', userId!)
      .single();

    if (existing) {
      const { error: updateError } = await supabase
        .from('citizen_sentiment')
        .update({
          sentiment,
          updated_at: new Date().toISOString(),
          ...(resolvedStakeAddress && { stake_address: resolvedStakeAddress }),
          ...(resolvedDrepId && { delegated_drep_id: resolvedDrepId }),
        })
        .eq('id', existing.id);

      if (updateError) {
        logger.error('Sentiment vote update error', {
          context: 'engagement/sentiment',
          error: updateError.message,
        });
        return NextResponse.json({ error: 'Failed to update sentiment' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from('citizen_sentiment').insert({
        proposal_tx_hash: proposalTxHash,
        proposal_index: proposalIndex,
        user_id: userId!,
        wallet_address: walletAddress,
        stake_address: resolvedStakeAddress,
        delegated_drep_id: resolvedDrepId,
        sentiment,
        initial_sentiment: sentiment,
      });

      if (insertError) {
        logger.error('Sentiment vote insert error', {
          context: 'engagement/sentiment',
          error: insertError.message,
        });
        return NextResponse.json({ error: 'Failed to record sentiment' }, { status: 500 });
      }
    }

    // Fire-and-forget: governance event
    supabase
      .from('governance_events')
      .insert({
        user_id: userId!,
        wallet_address: walletAddress,
        event_type: 'sentiment_vote',
        event_data: { sentiment, proposalTxHash },
        related_proposal_tx_hash: proposalTxHash,
        related_proposal_index: proposalIndex,
        epoch: currentEpoch,
      })
      .then(({ error: evtErr }) => {
        if (evtErr)
          logger.error('governance_event write failed', {
            context: 'sentiment-vote',
            error: evtErr.message,
          });
      });

    // Fetch updated community counts
    const { data: allVotes } = await supabase
      .from('citizen_sentiment')
      .select('sentiment')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex);

    const community = aggregateSentiment(allVotes || []);

    captureServerEvent(
      'citizen_sentiment_submitted',
      { proposal_tx_hash: proposalTxHash, proposal_index: proposalIndex, sentiment },
      walletAddress,
    );

    return NextResponse.json({
      community,
      userSentiment: sentiment,
      hasVoted: true,
    });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
