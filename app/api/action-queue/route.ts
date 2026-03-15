/**
 * Action Queue API — returns the unified urgency feed for the Home page.
 *
 * Requires segment + optional drepId/poolId to personalize actions.
 * Returns top 10 action items sorted by priority.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getActionQueue } from '@/lib/actionQueue';
import type { UserSegment } from '@/components/providers/SegmentProvider';

export const dynamic = 'force-dynamic';

const VALID_SEGMENTS = new Set(['anonymous', 'citizen', 'drep', 'spo', 'cc']);

export const GET = withRouteHandler(async (request: NextRequest) => {
  const segment = (request.nextUrl.searchParams.get('segment') ?? 'anonymous') as UserSegment;
  if (!VALID_SEGMENTS.has(segment)) {
    return NextResponse.json({ error: 'Invalid segment' }, { status: 400 });
  }

  const drepId = request.nextUrl.searchParams.get('drepId');
  const poolId = request.nextUrl.searchParams.get('poolId');
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
  const delegatedDrepId = request.nextUrl.searchParams.get('delegatedDrepId');

  const items = await getActionQueue(segment, { drepId, poolId, stakeAddress, delegatedDrepId });

  return NextResponse.json(
    { items },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    },
  );
});
