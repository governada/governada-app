import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { detectProposalTrends } from '@/lib/proposalTrends';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const GET = withRouteHandler(async () => {
  const trends = await detectProposalTrends();
  return NextResponse.json(trends);
});
