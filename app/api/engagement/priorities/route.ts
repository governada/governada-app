import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { PrioritySignalSchema } from '@/lib/api/schemas/engagement';
import { checkEpochRateLimit } from '@/lib/api/epochRateLimit';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const walletAddress = wallet!;
    const { rankedPriorities, epoch, stakeAddress } = PrioritySignalSchema.parse(
      await request.json(),
    );

    // Per-epoch rate limit (5 priority signals per epoch)
    const epochRL = await checkEpochRateLimit({
      action: 'priority',
      userId: userId!,
      epoch,
    });
    if (!epochRL.allowed) {
      return NextResponse.json(
        { error: `Priority signal limit reached for this epoch (${epochRL.limit} max)` },
        { status: 429 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Upsert: one signal per user per epoch
    const { data: existing } = await supabase
      .from('citizen_priority_signals')
      .select('id')
      .eq('user_id', userId!)
      .eq('epoch', epoch)
      .single();

    if (existing) {
      const { error: updateError } = await supabase
        .from('citizen_priority_signals')
        .update({
          ranked_priorities: rankedPriorities,
          updated_at: new Date().toISOString(),
          ...(stakeAddress && { stake_address: stakeAddress }),
        })
        .eq('id', existing.id);

      if (updateError) {
        logger.error('Priority signal update error', {
          context: 'engagement/priorities',
          error: updateError.message,
        });
        return NextResponse.json({ error: 'Failed to update signal' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from('citizen_priority_signals').insert({
        user_id: userId!,
        wallet_address: walletAddress,
        stake_address: stakeAddress || null,
        ranked_priorities: rankedPriorities,
        epoch,
      });

      if (insertError) {
        logger.error('Priority signal insert error', {
          context: 'engagement/priorities',
          error: insertError.message,
        });
        return NextResponse.json({ error: 'Failed to record signal' }, { status: 500 });
      }
    }

    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    supabase
      .from('governance_events')
      .insert({
        user_id: userId!,
        wallet_address: walletAddress,
        event_type: 'priority_signal',
        event_data: { rankedPriorities, epoch },
        epoch: currentEpoch,
      })
      .then(({ error: evtErr }) => {
        if (evtErr)
          logger.error('governance_event write failed', {
            context: 'priority-signal',
            error: evtErr.message,
          });
      });

    captureServerEvent(
      'citizen_priority_signaled',
      { ranked_priorities: rankedPriorities, epoch },
      walletAddress,
    );

    return NextResponse.json({ success: true });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
