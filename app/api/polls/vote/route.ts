import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { updateUserProfile } from '@/lib/matching/userProfile';
import { captureServerEvent } from '@/lib/posthog-server';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { PollVoteSchema } from '@/lib/api/schemas/governance';
import { fetchDelegatedDRep } from '@/utils/koios';

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

export const POST = withRouteHandler(async (request: NextRequest, { requestId, wallet }: RouteContext) => {
  const walletAddress = wallet!;
  const { proposalTxHash, proposalIndex, vote, stakeAddress, delegatedDrepId } =
    PollVoteSchema.parse(await request.json());

  const resolvedStakeAddress = stakeAddress || null;
  let resolvedDrepId = delegatedDrepId || null;

  if (!resolvedDrepId && resolvedStakeAddress) {
    resolvedDrepId = await fetchDelegatedDRep(resolvedStakeAddress);
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from('poll_responses')
    .select('id, vote_count')
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex)
    .eq('wallet_address', walletAddress)
    .single();

  if (existing) {
    const { error: updateError } = await supabase
      .from('poll_responses')
      .update({
        vote,
        updated_at: new Date().toISOString(),
        vote_count: (existing.vote_count || 1) + 1,
        ...(resolvedStakeAddress && { stake_address: resolvedStakeAddress }),
        ...(resolvedDrepId && { delegated_drep_id: resolvedDrepId }),
      })
      .eq('id', existing.id);

    if (updateError) {
      logger.error('Poll vote update error', { context: 'polls/vote', error: updateError?.message });
      return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase.from('poll_responses').insert({
      proposal_tx_hash: proposalTxHash,
      proposal_index: proposalIndex,
      wallet_address: walletAddress,
      stake_address: resolvedStakeAddress,
      delegated_drep_id: resolvedDrepId,
      vote,
      initial_vote: vote,
    });

    if (insertError) {
      logger.error('Poll vote insert error', { context: 'polls/vote', error: insertError?.message });
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
    }
  }

  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  let proposalTitle: string | null = null;
  try {
    const { data: proposal } = await supabase
      .from('proposals')
      .select('title')
      .eq('tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex)
      .single();
    proposalTitle = proposal?.title || null;
  } catch {
    /* non-critical */
  }

  supabase
    .from('governance_events')
    .insert({
      wallet_address: walletAddress,
      event_type: 'poll_vote',
      event_data: { vote, proposalTitle },
      related_proposal_tx_hash: proposalTxHash,
      related_proposal_index: proposalIndex,
      epoch: currentEpoch,
    })
    .then(({ error: evtErr }) => {
      if (evtErr) logger.error('governance_event write failed', { context: 'poll-vote', error: evtErr?.message });
    });

  updateUserProfile(walletAddress).catch((err) => {
    logger.error('Failed to update user profile', { context: 'poll-vote', error: err });
  });

  const { data: allVotes } = await supabase
    .from('poll_responses')
    .select('vote')
    .eq('proposal_tx_hash', proposalTxHash)
    .eq('proposal_index', proposalIndex);

  const community = aggregateCounts(allVotes || []);

  captureServerEvent(
    'poll_vote_submitted',
    { proposal_tx_hash: proposalTxHash, proposal_index: proposalIndex, vote },
    walletAddress,
  );

  return NextResponse.json({
    community,
    userVote: vote,
    hasVoted: true,
  });
}, { auth: 'required', rateLimit: { max: 10, window: 60 } });
