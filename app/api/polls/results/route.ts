import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { PollResultsResponse } from '@/types/supabase';

function aggregateCounts(rows: { vote: string }[]): {
  yes: number;
  no: number;
  abstain: number;
  total: number;
} {
  const counts = { yes: 0, no: 0, abstain: 0, total: rows.length };
  for (const row of rows) {
    if (row.vote === 'yes') counts.yes++;
    else if (row.vote === 'no') counts.no++;
    else if (row.vote === 'abstain') counts.abstain++;
  }
  return counts;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const proposalTxHash = searchParams.get('proposalTxHash');
  const proposalIndexStr = searchParams.get('proposalIndex');
  const drepId = searchParams.get('drepId');

  if (!proposalTxHash || !proposalIndexStr) {
    return NextResponse.json(
      { error: 'proposalTxHash and proposalIndex required' },
      { status: 400 },
    );
  }

  const proposalIndex = parseInt(proposalIndexStr, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'proposalIndex must be a number' }, { status: 400 });
  }

  let walletAddress: string | null = null;
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const session = await validateSessionToken(authHeader.slice(7));
    walletAddress = session?.walletAddress ?? null;
  }

  const supabase = getSupabaseAdmin();

  const { data: allVotes, error } = await supabase
    .from('poll_responses')
    .select('vote, wallet_address, delegated_drep_id')
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex);

  if (error) {
    console.error('Poll results query error:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }

  const rows = allVotes || [];
  const community = aggregateCounts(rows);

  let userVote: PollResultsResponse['userVote'] = null;
  if (walletAddress) {
    const userRow = rows.find((r) => r.wallet_address === walletAddress);
    if (userRow) userVote = userRow.vote as PollResultsResponse['userVote'];
  }

  const result: PollResultsResponse = {
    community,
    userVote,
    hasVoted: userVote !== null,
  };

  if (drepId) {
    const delegatorRows = rows.filter((r) => r.delegated_drep_id === drepId);
    result.delegators = aggregateCounts(delegatorRows);
  }

  return NextResponse.json(result);
}
