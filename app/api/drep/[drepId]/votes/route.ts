/**
 * DRep Votes API
 * Returns a DRep's vote choices keyed by proposal for client-side indicators.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const supabase = createClient();
    const { data: votes, error } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('drep_id', drepId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      votes: (votes || []).map((v: any) => ({
        proposalTxHash: v.proposal_tx_hash,
        proposalIndex: v.proposal_index,
        vote: v.vote,
      })),
    });
  } catch (err) {
    console.error('[DRep Votes API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
