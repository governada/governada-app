/**
 * Recent Votes Alignment API
 * Returns the last N votes for a DRep with per-vote alignment evaluation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getVotesByDRepId, getProposalsByIds } from '@/lib/data';
import { evaluateVoteAlignment } from '@/lib/alignment';
import { UserPrefKey } from '@/types/drep';

export const dynamic = 'force-dynamic';

const VALID_PREFS: UserPrefKey[] = [
  'treasury-conservative',
  'smart-treasury-growth',
  'strong-decentralization',
  'protocol-security-first',
  'innovation-defi-growth',
  'responsible-governance',
];

const MAX_VOTES = 10;

export const GET = withRouteHandler(async (request, { requestId }) => {
  const { searchParams } = new URL(request.url);
  const drepId = searchParams.get('drepId');
  const prefsParam = searchParams.get('prefs');

  if (!drepId) {
    return NextResponse.json({ error: 'drepId is required' }, { status: 400 });
  }

  const prefs = (prefsParam?.split(',').filter((p) => VALID_PREFS.includes(p as UserPrefKey)) ||
    []) as UserPrefKey[];

  if (prefs.length === 0) {
    return NextResponse.json({ votes: [] });
  }

  const allVotes = await getVotesByDRepId(drepId);
  const recentVotes = allVotes.slice(0, MAX_VOTES);

  if (recentVotes.length === 0) {
    return NextResponse.json({ votes: [] });
  }

  const proposalIds = recentVotes.map((v) => ({
    txHash: v.proposal_tx_hash,
    index: v.proposal_index,
  }));

  const proposalsMap = await getProposalsByIds(proposalIds);

  const results = recentVotes.map((vote) => {
    const key = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
    const proposal = proposalsMap.get(key);

    const alignment = evaluateVoteAlignment(
      vote.vote,
      !!vote.meta_url,
      proposal?.proposalType || null,
      proposal?.treasuryTier || null,
      proposal?.relevantPrefs || [],
      prefs,
    );

    return {
      voteTxHash: vote.vote_tx_hash,
      proposalTxHash: vote.proposal_tx_hash,
      proposalIndex: vote.proposal_index,
      vote: vote.vote,
      blockTime: vote.block_time,
      proposalTitle: proposal?.title || null,
      proposalType: proposal?.proposalType || null,
      alignment: alignment.status,
      reasons: alignment.reasons,
    };
  });

  return NextResponse.json({ votes: results });
});
