import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { ConcernFlagSchema, ConcernFlagRemoveSchema } from '@/lib/api/schemas/engagement';
import { checkEpochRateLimit } from '@/lib/api/epochRateLimit';

export const dynamic = 'force-dynamic';

// Add a concern flag
export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const walletAddress = wallet!;
    const { proposalTxHash, proposalIndex, flagType, stakeAddress } = ConcernFlagSchema.parse(
      await request.json(),
    );

    // Per-epoch rate limit (20 concern flags per epoch)
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const epochRL = await checkEpochRateLimit({
      action: 'concern',
      userId: userId!,
      epoch: currentEpoch,
    });
    if (!epochRL.allowed) {
      return NextResponse.json(
        { error: `Concern flag limit reached for this epoch (${epochRL.limit} max)` },
        { status: 429 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { error: insertError } = await supabase.from('citizen_concern_flags').insert({
      proposal_tx_hash: proposalTxHash,
      proposal_index: proposalIndex,
      user_id: userId!,
      wallet_address: walletAddress,
      stake_address: stakeAddress || null,
      flag_type: flagType,
    });

    if (insertError) {
      // Unique constraint violation = already flagged
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Already flagged' }, { status: 409 });
      }
      logger.error('Concern flag insert error', {
        context: 'engagement/concerns',
        error: insertError.message,
      });
      return NextResponse.json({ error: 'Failed to add flag' }, { status: 500 });
    }

    supabase
      .from('governance_events')
      .insert({
        user_id: userId!,
        wallet_address: walletAddress,
        event_type: 'concern_flag',
        event_data: { flagType, proposalTxHash },
        related_proposal_tx_hash: proposalTxHash,
        related_proposal_index: proposalIndex,
        epoch: currentEpoch,
      })
      .then(({ error: evtErr }) => {
        if (evtErr)
          logger.error('governance_event write failed', {
            context: 'concern-flag',
            error: evtErr.message,
          });
      });

    captureServerEvent(
      'citizen_concern_flagged',
      { proposal_tx_hash: proposalTxHash, proposal_index: proposalIndex, flag_type: flagType },
      walletAddress,
    );

    return NextResponse.json({ success: true });
  },
  { auth: 'required', rateLimit: { max: 20, window: 60 } },
);

// Remove a concern flag
export const DELETE = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const { proposalTxHash, proposalIndex, flagType } = ConcernFlagRemoveSchema.parse(
      await request.json(),
    );

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('citizen_concern_flags')
      .delete()
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex)
      .eq('user_id', userId!)
      .eq('flag_type', flagType);

    if (error) {
      logger.error('Concern flag delete error', {
        context: 'engagement/concerns',
        error: error.message,
      });
      return NextResponse.json({ error: 'Failed to remove flag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { auth: 'required' },
);
