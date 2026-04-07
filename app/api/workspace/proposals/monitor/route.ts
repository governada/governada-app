/**
 * Proposal Monitoring API: returns voting progress, deposit status,
 * and recent vote activity for a submitted governance action.
 *
 * GET /api/workspace/proposals/monitor?txHash=...&proposalIndex=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { buildProposalMonitorData, ProposalMonitorError } from '@/lib/workspace/proposalMonitor';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: NextRequest) => {
  const txHash = request.nextUrl.searchParams.get('txHash');
  const proposalIndexStr = request.nextUrl.searchParams.get('proposalIndex');

  if (!txHash || proposalIndexStr == null) {
    return NextResponse.json(
      { error: 'Missing txHash or proposalIndex query parameter' },
      { status: 400 },
    );
  }

  const proposalIndex = parseInt(proposalIndexStr, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'Invalid proposalIndex' }, { status: 400 });
  }

  try {
    const monitorData = await buildProposalMonitorData({ txHash, proposalIndex });
    return NextResponse.json(monitorData);
  } catch (error) {
    if (error instanceof ProposalMonitorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Failed to fetch proposal' }, { status: 500 });
  }
});
