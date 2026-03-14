/**
 * GET /api/you/what-changed?since=<unix_ms>
 *
 * Returns a summary of what happened in governance since the user's last visit.
 * Used by the WhatChanged hub component.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const sinceParam = request.nextUrl.searchParams.get('since');
    const sinceMs = sinceParam ? parseInt(sinceParam, 10) : Date.now() - 5 * 86400 * 1000;
    const sinceSeconds = Math.floor(sinceMs / 1000);
    const sinceDate = new Date(sinceMs).toISOString();

    const supabase = getSupabaseAdmin();
    const nowSeconds = Math.floor(Date.now() / 1000);
    const currentEpoch = blockTimeToEpoch(nowSeconds);
    const lastEpoch = blockTimeToEpoch(sinceSeconds);

    // Get user's delegated DRep
    let delegatedDrepId: string | null = null;
    if (userId) {
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('drep_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      delegatedDrepId = wallet?.drep_id ?? null;
    }

    // Parallel queries for what changed
    const [proposalsResult, drepVotesResult, milestonesResult] = await Promise.all([
      // Proposals decided since last visit
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .or(
          `ratified_epoch.gte.${lastEpoch},expired_epoch.gte.${lastEpoch},dropped_epoch.gte.${lastEpoch}`,
        ),

      // DRep votes since last visit (if user has a DRep)
      delegatedDrepId
        ? supabase
            .from('drep_votes')
            .select('vote_tx_hash', { count: 'exact', head: true })
            .eq('drep_id', delegatedDrepId)
            .gte('block_time', sinceSeconds)
        : Promise.resolve({ count: 0 }),

      // New milestones earned since last visit
      userId
        ? supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq(
              'user_stake_address',
              (
                await supabase
                  .from('user_wallets')
                  .select('stake_address')
                  .eq('user_id', userId)
                  .limit(1)
                  .maybeSingle()
              ).data?.stake_address ?? '',
            )
            .in('type', ['citizen-level-up', 'near-milestone'])
            .gte('created_at', sinceDate)
        : Promise.resolve({ count: 0 }),
    ]);

    return NextResponse.json({
      lastEpoch,
      currentEpoch,
      proposalsDecided: proposalsResult.count ?? 0,
      drepVotes: drepVotesResult.count ?? 0,
      newMilestones: milestonesResult.count ?? 0,
      newEndorsements: 0,
    });
  },
  { auth: 'optional' },
);
