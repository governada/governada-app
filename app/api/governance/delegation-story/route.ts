/**
 * GET /api/governance/delegation-story
 *
 * Returns a longitudinal narrative of the user's delegation relationship:
 * when they delegated, DRep performance since then, vote counts, score range.
 *
 * Requires auth (reads user_wallets to find stake address + delegation).
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

interface DRepRowInfo {
  name?: string | null;
  handle?: string | null;
  ticker?: string | null;
}

export const GET = withRouteHandler(
  async (_request, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get user's delegation info
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('drep_id, stake_address')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!wallet?.drep_id) {
      return NextResponse.json({ error: 'No DRep delegation found' }, { status: 404 });
    }

    const drepId = wallet.drep_id;

    // 2. Get DRep name from dreps table
    const { data: drep } = await supabase
      .from('dreps')
      .select('info, score')
      .eq('id', drepId)
      .single();

    const info = drep?.info as DRepRowInfo | null;
    const drepName = info?.name || info?.handle || info?.ticker || drepId.slice(0, 16) + '...';

    // 3. Check delegation_history on users table for delegation epoch
    const { data: user } = await supabase
      .from('users')
      .select('delegation_history')
      .eq('id', userId)
      .single();

    // delegation_history is Json[] — each entry may have { drep_id, epoch, ... }
    const history = (user?.delegation_history ?? []) as Array<Record<string, unknown>>;
    let delegatedSinceEpoch: number | null = null;

    // Find the earliest entry for the current DRep
    for (const entry of history) {
      if (entry.drep_id === drepId && typeof entry.epoch === 'number') {
        if (delegatedSinceEpoch == null || entry.epoch < delegatedSinceEpoch) {
          delegatedSinceEpoch = entry.epoch;
        }
      }
    }

    // Fallback: use the DRep's first vote as a proxy if no history
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    if (delegatedSinceEpoch == null) {
      // Use citizen_epoch_snapshots to find earliest snapshot with this DRep
      const { data: earliest } = await supabase
        .from('citizen_epoch_snapshots')
        .select('epoch_no')
        .eq('user_id', userId)
        .eq('delegated_drep_id', drepId)
        .order('epoch_no', { ascending: true })
        .limit(1)
        .maybeSingle();

      delegatedSinceEpoch = earliest?.epoch_no ?? currentEpoch;
    }

    const sinceEpoch = delegatedSinceEpoch ?? currentEpoch;
    const epochsActive = Math.max(0, currentEpoch - sinceEpoch);

    // 4. Count votes since delegation
    const { count: totalVotes } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('drep_id', drepId)
      .gte('epoch_no', sinceEpoch);

    // 5. Get score range since delegation from drep_score_history
    const { data: scoreHistory } = await supabase
      .from('drep_score_history')
      .select('score')
      .eq('drep_id', drepId)
      .gte('epoch_no', sinceEpoch)
      .order('epoch_no', { ascending: true });

    let minScore = drep?.score ?? 0;
    let maxScore = drep?.score ?? 0;

    if (scoreHistory && scoreHistory.length > 0) {
      const scores = scoreHistory.map((s) => Math.round(s.score));
      minScore = Math.min(...scores);
      maxScore = Math.max(...scores);
    }

    return NextResponse.json(
      {
        delegatedSince: sinceEpoch,
        currentDrep: drepName,
        totalVotes: totalVotes ?? 0,
        scoreRange: [Math.round(minScore), Math.round(maxScore)],
        epochsActive,
      },
      {
        headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=120' },
      },
    );
  },
  { auth: 'required' },
);
