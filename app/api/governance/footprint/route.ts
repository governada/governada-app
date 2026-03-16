import { NextRequest, NextResponse } from 'next/server';
import { buildGovernanceFootprint } from '@/lib/governanceFootprint';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { isAdminWallet } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');

    // Admin-only: override delegated DRep for "View As" simulation
    const delegatedDrepOverride =
      wallet && isAdminWallet(wallet)
        ? request.nextUrl.searchParams.get('delegatedDrepOverride')
        : null;

    const footprint = await buildGovernanceFootprint(userId!, stakeAddress, {
      delegatedDrepOverride,
    });

    return NextResponse.json(footprint, {
      headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' },
    });
  },
  { auth: 'required' },
);
