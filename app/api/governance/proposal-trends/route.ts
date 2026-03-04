import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { detectProposalTrends } from '@/lib/proposalTrends';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const GET = withRouteHandler(async (_request, { requestId }) => {
    const trends = await detectProposalTrends();
    return NextResponse.json(trends);
});
