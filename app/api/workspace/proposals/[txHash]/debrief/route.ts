/**
 * Proposal Debrief API — fetch on-chain proposal lifecycle data for debrief view.
 *
 * GET /api/workspace/proposals/[txHash]/debrief
 * Returns the proposal's terminal status (ratified/expired/dropped) and epoch info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function extractTxHash(pathname: string): string | null {
  const match = pathname.match(/\/proposals\/([^/]+)\/debrief/);
  return match?.[1] ?? null;
}

export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const txHash = extractTxHash(request.nextUrl.pathname);
    if (!txHash) {
      return NextResponse.json({ error: 'Missing txHash' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: row, error } = await admin
      .from('proposals')
      .select(
        'tx_hash, proposal_index, proposal_type, ratified_epoch, expired_epoch, dropped_epoch, enacted_epoch',
      )
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch proposal' }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ proposal: null });
    }

    return NextResponse.json({
      proposal: {
        txHash: row.tx_hash,
        proposalIndex: row.proposal_index,
        proposalType: row.proposal_type,
        ratifiedEpoch: row.ratified_epoch,
        expiredEpoch: row.expired_epoch,
        droppedEpoch: row.dropped_epoch,
        enactedEpoch: row.enacted_epoch,
      },
    });
  },
  { auth: 'optional' },
);
