import { NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getImpactScore } from '@/lib/citizenImpactScore';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request, { userId }: RouteContext) => {
    const breakdown = await getImpactScore(userId!);

    if (!breakdown) {
      return NextResponse.json(
        {
          score: 0,
          delegationTenureScore: 0,
          repActivityScore: 0,
          engagementDepthScore: 0,
          coverageScore: 0,
          computed: false,
        },
        { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120' } },
      );
    }

    return NextResponse.json(
      { ...breakdown, computed: true },
      { headers: { 'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120' } },
    );
  },
  { auth: 'required' },
);
