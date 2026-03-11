/**
 * Curated proposals API — returns a smart queue of proposals for the
 * guided voting experience at /match/vote.
 *
 * Prioritises:
 * 1. Active (Open) proposals the user hasn't voted on, expiring soonest.
 * 2. Type diversity — surfaces types the user hasn't voted on yet.
 * 3. Historical (Enacted/Ratified) backfill when active proposals are scarce.
 *
 * Includes alignment dimension scores (from proposal_classifications) and
 * delegated DRep's vote per proposal (from drep_votes) when available.
 *
 * Auth is optional — anonymous users get the queue without filtering already-voted.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const MAX_QUEUE = 8;

export const GET = withRouteHandler(async (request, { userId }) => {
  const supabase = getSupabaseAdmin();
  const url = new URL(request.url);
  const drepId = url.searchParams.get('drepId');

  // Fetch governance epoch for status calculation
  const { data: statsRow } = await supabase
    .from('governance_stats')
    .select('current_epoch')
    .eq('id', 1)
    .single();
  const currentEpoch: number | null = statsRow?.current_epoch ?? null;

  // Fetch proposals with AI summaries + classification relevance
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, expiration_epoch, proposed_epoch, expired_epoch, ratified_epoch, enacted_epoch, dropped_epoch, withdrawal_amount, relevant_prefs',
    )
    .order('proposed_epoch', { ascending: false })
    .limit(200);

  if (!proposals?.length) {
    return NextResponse.json({ proposals: [], currentEpoch, votedTxHashes: [] });
  }

  // Fetch community poll responses for these proposals
  const txHashes = proposals.map((p) => p.tx_hash);

  // Run independent queries in parallel
  const [pollAggResult, classificationsResult] = await Promise.all([
    supabase
      .from('poll_responses')
      .select('proposal_tx_hash, proposal_index, vote')
      .in('proposal_tx_hash', txHashes),
    supabase
      .from('proposal_classifications')
      .select(
        'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
      )
      .in('proposal_tx_hash', txHashes),
  ]);

  const pollAgg = pollAggResult.data;
  const classifications = classificationsResult.data;

  // Build classification lookup
  const classificationMap = new Map<
    string,
    {
      treasuryConservative: number;
      treasuryGrowth: number;
      decentralization: number;
      security: number;
      innovation: number;
      transparency: number;
    }
  >();
  for (const c of classifications ?? []) {
    const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
    classificationMap.set(key, {
      treasuryConservative: c.dim_treasury_conservative,
      treasuryGrowth: c.dim_treasury_growth,
      decentralization: c.dim_decentralization,
      security: c.dim_security,
      innovation: c.dim_innovation,
      transparency: c.dim_transparency,
    });
  }

  // Build community vote counts per proposal
  const communityMap = new Map<
    string,
    { yes: number; no: number; abstain: number; total: number }
  >();
  for (const row of pollAgg ?? []) {
    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    const entry = communityMap.get(key) ?? { yes: 0, no: 0, abstain: 0, total: 0 };
    if (row.vote === 'yes') entry.yes++;
    else if (row.vote === 'no') entry.no++;
    else if (row.vote === 'abstain') entry.abstain++;
    entry.total++;
    communityMap.set(key, entry);
  }

  // If authenticated, fetch user's existing votes to exclude
  const votedKeys = new Set<string>();
  const votedTypes = new Set<string>();
  if (userId) {
    const { data: userVotes } = await supabase
      .from('poll_responses')
      .select('proposal_tx_hash, proposal_index')
      .eq('user_id', userId);
    if (userVotes) {
      for (const v of userVotes) {
        votedKeys.add(`${v.proposal_tx_hash}-${v.proposal_index}`);
      }
    }
    // Get voted proposal types for diversity tracking
    if (userVotes?.length) {
      const votedTxHashes = userVotes.map((v) => v.proposal_tx_hash);
      const { data: votedProposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_type')
        .in('tx_hash', votedTxHashes);
      if (votedProposals) {
        for (const p of votedProposals) {
          if (p.proposal_type) votedTypes.add(p.proposal_type);
        }
      }
    }
  }

  // Classify proposals by status
  type ProposalRow = (typeof proposals)[number];

  function getStatus(p: ProposalRow): string {
    if (p.enacted_epoch) return 'Enacted';
    if (p.ratified_epoch) return 'Ratified';
    if (p.expired_epoch) return 'Expired';
    if (p.dropped_epoch) return 'Dropped';
    return 'Open';
  }

  // Split into active vs historical
  const active: ProposalRow[] = [];
  const historical: ProposalRow[] = [];

  for (const p of proposals) {
    const key = `${p.tx_hash}-${p.proposal_index}`;
    if (votedKeys.has(key)) continue; // Skip already voted
    const status = getStatus(p);
    if (status === 'Open') {
      active.push(p);
    } else if (status === 'Enacted' || status === 'Ratified') {
      historical.push(p);
    }
  }

  // Sort active by expiration (soonest first), then boost types user hasn't voted on
  active.sort((a, b) => {
    // Boost unvoted types
    const aNewType = a.proposal_type && !votedTypes.has(a.proposal_type) ? 1 : 0;
    const bNewType = b.proposal_type && !votedTypes.has(b.proposal_type) ? 1 : 0;
    if (aNewType !== bNewType) return bNewType - aNewType;
    // Then by expiration (soonest first)
    const aExp = a.expiration_epoch ?? 9999;
    const bExp = b.expiration_epoch ?? 9999;
    return aExp - bExp;
  });

  // Build queue: active first, backfill with historical
  const queue: ProposalRow[] = [];
  const usedTypes = new Set<string>();

  // Priority 1: Active proposals (prioritise type diversity)
  for (const p of active) {
    if (queue.length >= MAX_QUEUE) break;
    queue.push(p);
    if (p.proposal_type) usedTypes.add(p.proposal_type);
  }

  // Priority 2: Backfill with historical if needed (prefer diverse types)
  if (queue.length < MAX_QUEUE) {
    // Sort historical: prioritise types not yet in queue
    historical.sort((a, b) => {
      const aNew = a.proposal_type && !usedTypes.has(a.proposal_type) ? 1 : 0;
      const bNew = b.proposal_type && !usedTypes.has(b.proposal_type) ? 1 : 0;
      if (aNew !== bNew) return bNew - aNew;
      // Prefer proposals with AI summaries
      const aHasSummary = a.ai_summary ? 1 : 0;
      const bHasSummary = b.ai_summary ? 1 : 0;
      return bHasSummary - aHasSummary;
    });

    for (const p of historical) {
      if (queue.length >= MAX_QUEUE) break;
      queue.push(p);
    }
  }

  // Fetch delegated DRep's votes for queued proposals (if drepId provided)
  const drepVoteMap = new Map<string, string>();
  if (drepId && queue.length > 0) {
    const queueTxHashes = queue.map((p) => p.tx_hash);
    const { data: drepVotes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('drep_id', drepId)
      .in('proposal_tx_hash', queueTxHashes);
    for (const v of drepVotes ?? []) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      drepVoteMap.set(key, v.vote);
    }
  }

  // Format a proposal for the response
  function formatProposal(p: ProposalRow) {
    const status = getStatus(p);
    const key = `${p.tx_hash}-${p.proposal_index}`;
    const community = communityMap.get(key) ?? null;
    const dimensions = classificationMap.get(key) ?? null;
    const drepVote = drepVoteMap.get(key) ?? null;
    return {
      txHash: p.tx_hash,
      index: p.proposal_index,
      title: p.title,
      summary: p.ai_summary || p.abstract || null,
      type: p.proposal_type,
      status,
      expirationEpoch: p.expiration_epoch ?? null,
      withdrawalAmount: p.withdrawal_amount != null ? Number(p.withdrawal_amount) : null,
      relevantPrefs: p.relevant_prefs ?? [],
      community,
      isHistorical: status !== 'Open',
      dimensions,
      drepVote,
    };
  }

  return NextResponse.json({
    proposals: queue.map(formatProposal),
    currentEpoch,
    votedTypes: Array.from(votedTypes),
    totalVoted: votedKeys.size,
  });
});
