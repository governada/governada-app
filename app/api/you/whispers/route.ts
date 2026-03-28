/**
 * GET /api/you/whispers
 *
 * Lightweight endpoint returning proactive whisper data for Seneca.
 * Returns at most 3 prioritized, pre-formatted whisper strings.
 * Designed for low-latency: parallel queries, no AI, no heavy joins.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCurrentEpoch } from '@/lib/constants';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

interface WhisperData {
  whispers: string[];
  epoch: number;
}

export const GET = withRouteHandler(
  async (_request, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const epoch = getCurrentEpoch();
    const whispers: string[] = [];

    if (!userId) {
      // Anonymous: return epoch-based whispers only
      const { count: activeCount } = await supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .is('ratified_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null);

      if (activeCount && activeCount > 0) {
        whispers.push(
          `${activeCount} proposal${activeCount !== 1 ? 's' : ''} are being decided this epoch. Your voice matters.`,
        );
      }

      return NextResponse.json({ whispers, epoch } satisfies WhisperData);
    }

    // Authenticated: get user's delegation context
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('stake_address, drep_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    const delegatedDrepId = wallet?.drep_id ?? null;
    const stakeAddress = wallet?.stake_address ?? null;

    // Parallel lightweight queries
    const [scoreChangeResult, whatChangedResult, proposalResult] = await Promise.all([
      // 1. DRep score change (if delegating)
      delegatedDrepId
        ? supabase
            .from('drep_score_history')
            .select('score, snapshot_date')
            .eq('drep_id', delegatedDrepId)
            .order('snapshot_date', { ascending: false })
            .limit(2)
        : Promise.resolve({ data: null }),

      // 2. What happened since last visit (notifications count)
      stakeAddress
        ? supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_stake_address', stakeAddress)
            .eq('read', false)
        : Promise.resolve({ count: null }),

      // 3. Active proposals needing attention
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .is('ratified_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null),
    ]);

    // Build whispers in priority order (most actionable first)

    // P1: DRep score dropped significantly
    if (scoreChangeResult.data && scoreChangeResult.data.length >= 2) {
      const [current, previous] = scoreChangeResult.data;
      const delta = current.score - previous.score;
      if (delta <= -3) {
        // Get DRep name for personalization
        const { data: drep } = await supabase
          .from('dreps')
          .select('name, ticker')
          .eq('drep_id', delegatedDrepId!)
          .limit(1)
          .maybeSingle();
        const name = drep?.name || drep?.ticker || 'Your DRep';
        whispers.push(`${name}'s score dropped ${Math.abs(delta)} points. Worth a look.`);
      } else if (delta >= 5) {
        whispers.push(`Your DRep's score improved +${delta} points this epoch. Good sign.`);
      }
    }

    // P2: Unread notifications (governance events happened)
    if (whatChangedResult.count && whatChangedResult.count > 0) {
      const count = whatChangedResult.count;
      if (count >= 3) {
        whispers.push(`${count} governance updates since your last visit.`);
      }
    }

    // P3: Active proposals (epoch urgency)
    if (proposalResult.count && proposalResult.count > 0) {
      const count = proposalResult.count;
      if (!delegatedDrepId) {
        // No delegation — nudge toward match
        whispers.push(
          `${count} proposal${count !== 1 ? 's' : ''} being decided — and nobody's voting for you yet.`,
        );
      }
    }

    // P4: No delegation nudge (if applicable and no other whispers)
    if (whispers.length === 0 && !delegatedDrepId && stakeAddress) {
      whispers.push(`You're holding ADA but nobody represents you in governance.`);
    }

    return NextResponse.json({
      whispers: whispers.slice(0, 3),
      epoch,
    } satisfies WhisperData);
  },
  { auth: 'optional' },
);
