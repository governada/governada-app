/**
 * GET /api/engagement/credibility
 *
 * Returns the authenticated user's citizen credibility tier and weight.
 * Used by the engage page to show users their signal weight tier.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { computeCredibility } from '@/lib/citizenCredibility';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request, ctx: RouteContext) => {
    const result = await computeCredibility(ctx.userId ?? null, ctx.wallet ?? null);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' },
    });
  },
  { auth: 'optional' },
);
