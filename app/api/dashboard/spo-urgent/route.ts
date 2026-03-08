/**
 * SPO Urgent Dashboard API
 * Returns pending proposals, urgent (expiring) proposals, unexplained votes,
 * and governance statement status for the SPO Command Center.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalDisplayTitle } from '@/utils/display';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const poolId = request.nextUrl.searchParams.get('poolId');
  if (!poolId) {
    return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });
  }

  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Fetch open proposals and SPO's votes in parallel
  const [openResult, votesResult, poolResult] = await Promise.all([
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type, expiration_epoch')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false }),
    supabase.from('spo_votes').select('proposal_tx_hash, proposal_index').eq('pool_id', poolId),
    supabase.from('pools').select('governance_statement').eq('pool_id', poolId).single(),
  ]);

  const openProposals = openResult.data ?? [];
  const spoVotes = votesResult.data ?? [];
  const pool = poolResult.data;

  const votedKeys = new Set(spoVotes.map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`));

  // Pending proposals (unvoted)
  const pending = openProposals.filter((p) => !votedKeys.has(`${p.tx_hash}-${p.proposal_index}`));

  // Urgent proposals (expiring within 2 epochs)
  const urgent = pending
    .filter((p) => {
      const expiryEpoch = p.expiration_epoch ?? 0;
      return expiryEpoch > 0 && expiryEpoch - currentEpoch <= 2;
    })
    .map((p) => {
      const expiryEpoch = p.expiration_epoch ?? 0;
      return {
        txHash: p.tx_hash,
        index: p.proposal_index,
        title: getProposalDisplayTitle(p.title, p.tx_hash, p.proposal_index),
        proposalType: p.proposal_type || 'Proposal',
        epochsRemaining: Math.max(0, expiryEpoch - currentEpoch),
      };
    })
    .sort((a, b) => a.epochsRemaining - b.epochsRemaining);

  // Top pending proposals list (up to 5, sorted by expiry)
  const pendingList = pending
    .map((p) => {
      const expiryEpoch = p.expiration_epoch ?? 0;
      return {
        txHash: p.tx_hash,
        index: p.proposal_index,
        title: getProposalDisplayTitle(p.title, p.tx_hash, p.proposal_index),
        proposalType: p.proposal_type || 'Proposal',
        epochsRemaining: expiryEpoch > 0 ? Math.max(0, expiryEpoch - currentEpoch) : null,
      };
    })
    .sort((a, b) => (a.epochsRemaining ?? 999) - (b.epochsRemaining ?? 999))
    .slice(0, 5);

  // Unexplained votes (recent SPO votes without rationale)
  let unexplainedVotes: { txHash: string; index: number; title: string }[] = [];
  try {
    const { data: recentVotes } = await supabase
      .from('spo_votes')
      .select('proposal_tx_hash, proposal_index')
      .eq('pool_id', poolId)
      .order('block_time', { ascending: false })
      .limit(10);

    if (recentVotes && recentVotes.length > 0) {
      const { data: rationales } = await supabase
        .from('vote_rationales')
        .select('proposal_tx_hash, proposal_index')
        .eq('voter_id', poolId)
        .eq('voter_type', 'spo');

      const rationaleSet = new Set(
        (rationales ?? []).map((r) => `${r.proposal_tx_hash}-${r.proposal_index}`),
      );

      const unexplained = recentVotes.filter(
        (v) => !rationaleSet.has(`${v.proposal_tx_hash}-${v.proposal_index}`),
      );

      if (unexplained.length > 0) {
        const txHashes = [...new Set(unexplained.map((v) => v.proposal_tx_hash))];
        const { data: proposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title')
          .in('tx_hash', txHashes);

        const titleMap = new Map(
          (proposals ?? []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p.title]),
        );

        unexplainedVotes = unexplained.map((v) => ({
          txHash: v.proposal_tx_hash,
          index: v.proposal_index,
          title: titleMap.get(`${v.proposal_tx_hash}-${v.proposal_index}`) || 'Untitled Proposal',
        }));
      }
    }
  } catch (err) {
    logger.error('SPO unexplained votes check failed', {
      context: 'dashboard/spo-urgent',
      error: err,
    });
  }

  const hasGovernanceStatement = !!(
    pool?.governance_statement && pool.governance_statement.trim().length > 0
  );

  return NextResponse.json({
    proposals: urgent,
    unexplainedVotes,
    pendingProposals: pendingList,
    pendingCount: pending.length,
    hasGovernanceStatement,
  });
});
