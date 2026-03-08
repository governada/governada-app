import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { EndorsementToggleSchema } from '@/lib/api/schemas/engagement';
import { checkEpochRateLimit } from '@/lib/api/epochRateLimit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engagement/endorsements?entityType=drep&entityId=drep1...
 *
 * Returns endorsement counts by type + whether the current user has endorsed.
 */
export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const { searchParams } = request.nextUrl;
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch all endorsements for this entity
    const { data: endorsements, error } = await supabase
      .from('citizen_endorsements')
      .select('endorsement_type, user_id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);

    if (error) {
      logger.error('Endorsements fetch error', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch endorsements' }, { status: 500 });
    }

    // Aggregate by type
    const byType: Record<string, number> = {};
    let total = 0;
    const userTypes: string[] = [];

    for (const e of endorsements || []) {
      byType[e.endorsement_type] = (byType[e.endorsement_type] || 0) + 1;
      total++;
      if (userId && e.user_id === userId) {
        userTypes.push(e.endorsement_type);
      }
    }

    return NextResponse.json({
      entityType,
      entityId,
      total,
      byType,
      userEndorsements: userTypes,
    });
  },
  { auth: 'optional' },
);

/**
 * POST /api/engagement/endorsements
 *
 * Toggle an endorsement on/off. If the user already has this endorsement type
 * for this entity, it removes it. Otherwise, it adds it.
 */
export const POST = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const walletAddress = wallet!;
    const { entityType, entityId, endorsementType, stakeAddress } = EndorsementToggleSchema.parse(
      await request.json(),
    );

    const resolvedStakeAddress = stakeAddress || null;

    // Per-epoch rate limit (30 endorsements per epoch)
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const epochRL = await checkEpochRateLimit({
      action: 'endorsement',
      userId: userId!,
      epoch: currentEpoch,
    });
    if (!epochRL.allowed) {
      return NextResponse.json(
        { error: `Endorsement limit reached for this epoch (${epochRL.limit} max)` },
        { status: 429 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if endorsement already exists
    const { data: existing } = await supabase
      .from('citizen_endorsements')
      .select('id')
      .eq('user_id', userId!)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('endorsement_type', endorsementType)
      .maybeSingle();

    let action: 'added' | 'removed';

    if (existing) {
      // Remove endorsement (toggle off)
      const { error: deleteError } = await supabase
        .from('citizen_endorsements')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        logger.error('Endorsement delete error', { error: deleteError.message });
        return NextResponse.json({ error: 'Failed to remove endorsement' }, { status: 500 });
      }
      action = 'removed';
    } else {
      // Add endorsement (toggle on)
      const { error: insertError } = await supabase.from('citizen_endorsements').insert({
        user_id: userId!,
        entity_type: entityType,
        entity_id: entityId,
        endorsement_type: endorsementType,
        wallet_address: walletAddress,
        stake_address: resolvedStakeAddress,
      });

      if (insertError) {
        logger.error('Endorsement insert error', { error: insertError.message });
        return NextResponse.json({ error: 'Failed to add endorsement' }, { status: 500 });
      }
      action = 'added';
    }

    // Fire-and-forget: governance event
    supabase
      .from('governance_events')
      .insert({
        user_id: userId!,
        wallet_address: walletAddress,
        event_type: 'endorsement',
        event_data: { entityType, entityId, endorsementType, action },
        epoch: currentEpoch,
      })
      .then(({ error: evtErr }) => {
        if (evtErr)
          logger.error('governance_event write failed', {
            context: 'endorsement',
            error: evtErr.message,
          });
      });

    captureServerEvent(
      'citizen_endorsement_toggled',
      { entity_type: entityType, entity_id: entityId, endorsement_type: endorsementType, action },
      walletAddress,
    );

    return NextResponse.json({ action, endorsementType, entityType, entityId });
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
