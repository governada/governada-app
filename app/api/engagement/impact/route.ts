import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { ImpactTagSchema } from '@/lib/api/schemas/engagement';
import { checkEpochRateLimit } from '@/lib/api/epochRateLimit';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const walletAddress = wallet!;
    const { proposalTxHash, proposalIndex, awareness, rating, comment, stakeAddress } =
      ImpactTagSchema.parse(await request.json());

    // Per-epoch rate limit (30 impact tags per epoch)
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const epochRL = await checkEpochRateLimit({
      action: 'impact',
      userId: userId!,
      epoch: currentEpoch,
    });
    if (!epochRL.allowed) {
      return NextResponse.json(
        { error: `Impact tag limit reached for this epoch (${epochRL.limit} max)` },
        { status: 429 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Upsert: one impact tag per user per proposal
    const { data: existing } = await supabase
      .from('citizen_impact_tags')
      .select('id')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex)
      .eq('user_id', userId!)
      .single();

    if (existing) {
      const { error: updateError } = await supabase
        .from('citizen_impact_tags')
        .update({
          awareness,
          rating,
          comment: comment || null,
          updated_at: new Date().toISOString(),
          ...(stakeAddress && { stake_address: stakeAddress }),
        })
        .eq('id', existing.id);

      if (updateError) {
        logger.error('Impact tag update error', {
          context: 'engagement/impact',
          error: updateError.message,
        });
        return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from('citizen_impact_tags').insert({
        proposal_tx_hash: proposalTxHash,
        proposal_index: proposalIndex,
        user_id: userId!,
        wallet_address: walletAddress,
        stake_address: stakeAddress || null,
        awareness,
        rating,
        comment: comment || null,
      });

      if (insertError) {
        logger.error('Impact tag insert error', {
          context: 'engagement/impact',
          error: insertError.message,
        });
        return NextResponse.json({ error: 'Failed to record feedback' }, { status: 500 });
      }
    }

    supabase
      .from('governance_events')
      .insert({
        user_id: userId!,
        wallet_address: walletAddress,
        event_type: 'impact_tag',
        event_data: { awareness, rating, proposalTxHash },
        related_proposal_tx_hash: proposalTxHash,
        related_proposal_index: proposalIndex,
        epoch: currentEpoch,
      })
      .then(({ error: evtErr }) => {
        if (evtErr)
          logger.error('governance_event write failed', {
            context: 'impact-tag',
            error: evtErr.message,
          });
      });

    captureServerEvent(
      'citizen_impact_tagged',
      {
        proposal_tx_hash: proposalTxHash,
        proposal_index: proposalIndex,
        awareness,
        rating,
      },
      walletAddress,
    );

    return NextResponse.json({ success: true });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
