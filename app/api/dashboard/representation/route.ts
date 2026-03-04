import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: pollResponses } = await supabase
    .from('poll_responses')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('delegated_drep_id', drepId);

  if (!pollResponses || pollResponses.length === 0) {
    return NextResponse.json({
      alignment: null,
      proposals: [],
      message: 'No delegator poll data',
    });
  }

  const { data: drepVotes } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index, vote')
    .eq('drep_id', drepId);

  if (!drepVotes) {
    return NextResponse.json({ alignment: null, proposals: [] });
  }

  const proposalPolls = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const pr of pollResponses) {
    const key = `${pr.proposal_tx_hash}-${pr.proposal_index}`;
    if (!proposalPolls.has(key)) proposalPolls.set(key, { yes: 0, no: 0, abstain: 0 });
    const counts = proposalPolls.get(key)!;
    if (pr.vote === 'Yes') counts.yes++;
    else if (pr.vote === 'No') counts.no++;
    else counts.abstain++;
  }

  const drepVoteMap = new Map<string, string>();
  for (const v of drepVotes) {
    drepVoteMap.set(`${v.proposal_tx_hash}-${v.proposal_index}`, v.vote);
  }

  const proposalKeys = [...proposalPolls.keys()];
  const proposalIds = proposalKeys.map((k) => {
    const [txHash, index] = k.split('-');
    return { tx_hash: txHash, proposal_index: parseInt(index) };
  });

  const titles = new Map<string, string>();
  if (proposalIds.length > 0) {
    const txHashes = [...new Set(proposalIds.map((p) => p.tx_hash))];
    const { data: proposals } = await supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title')
      .in('tx_hash', txHashes);
    if (proposals) {
      for (const p of proposals) {
        titles.set(
          `${p.tx_hash}-${p.proposal_index}`,
          p.title || `Proposal ${p.tx_hash.slice(0, 8)}...`,
        );
      }
    }
  }

  const MIN_RESPONSES = 3;
  let alignedCount = 0;
  let totalCompared = 0;
  const proposalBreakdown: any[] = [];

  for (const [key, counts] of proposalPolls.entries()) {
    const total = counts.yes + counts.no + counts.abstain;
    if (total < MIN_RESPONSES) continue;

    const drepVote = drepVoteMap.get(key);
    if (!drepVote) continue;

    const majority =
      counts.yes >= counts.no && counts.yes >= counts.abstain
        ? 'Yes'
        : counts.no >= counts.yes && counts.no >= counts.abstain
          ? 'No'
          : 'Abstain';

    const majorityPct = Math.round(
      (Math.max(counts.yes, counts.no, counts.abstain) / total) * 100,
    );
    const aligned = drepVote === majority;

    if (aligned) alignedCount++;
    totalCompared++;

    proposalBreakdown.push({
      key,
      title: titles.get(key) || key,
      drepVote,
      delegatorMajority: majority,
      delegatorMajorityPct: majorityPct,
      totalResponses: total,
      aligned,
    });
  }

  const alignmentPct =
    totalCompared > 0 ? Math.round((alignedCount / totalCompared) * 100) : null;

  return NextResponse.json({
    alignment: alignmentPct,
    totalCompared,
    alignedCount,
    proposals: proposalBreakdown.sort((a, b) => (a.aligned ? 1 : 0) - (b.aligned ? 1 : 0)),
  });
});
