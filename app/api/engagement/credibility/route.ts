/**
 * GET /api/engagement/credibility
 *
 * Returns the authenticated user's citizen credibility tier and weight.
 * Used by the engage page to show users their signal weight tier.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { computeCredibility } from '@/lib/citizenCredibility';
import { computeEngagementLevel } from '@/lib/citizen/engagementLevel';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request, ctx: RouteContext) => {
    const result = await computeCredibility(ctx.userId ?? null, ctx.wallet ?? null);

    // Derive engagement signals from existing data
    const hasEngaged = result.factors.priorEngagementCount > 0;

    // Count distinct epochs with governance events as visit streak proxy
    let visitStreak = 0;
    if (ctx.userId && hasEngaged) {
      const supabase = getSupabaseAdmin();
      const { data: epochRows } = await supabase
        .from('governance_events')
        .select('epoch')
        .eq('user_id', ctx.userId)
        .order('epoch', { ascending: false })
        .limit(100);
      if (epochRows) {
        visitStreak = new Set(epochRows.map((r) => r.epoch)).size;
      }
    }

    const engagementLevel = computeEngagementLevel({
      hasDelegation: result.factors.delegationActive,
      epochRecapViewCount: hasEngaged ? 1 : 0,
      pollParticipationCount: result.factors.priorEngagementCount,
      shareCount: 0,
      visitStreak,
      accountAgeDays: 0,
    });

    return NextResponse.json(
      {
        ...result,
        engagementLevel: {
          level: engagementLevel.level,
          nextLevel: engagementLevel.nextLevel,
          progressToNext: engagementLevel.progressToNext,
        },
      },
      {
        headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' },
      },
    );
  },
  { auth: 'optional' },
);
