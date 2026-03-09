/**
 * SPO Governance Inbox API
 * Returns open proposals the SPO hasn't voted on, with score impact estimates.
 * SPOs can vote on: ParameterChange, HardForkInitiation, NoConfidence,
 * NewCommittee/NewConstitutionalCommittee, NewConstitution/UpdateConstitution.
 * TreasuryWithdrawals and InfoAction are DRep-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { getProposalDisplayTitle } from '@/utils/display';
import { getProposalPriority } from '@/utils/proposalPriority';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/** Proposal types that accept SPO votes */
const SPO_VOTABLE_TYPES = [
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

export const GET = withRouteHandler(async (request: NextRequest) => {
  const poolId = request.nextUrl.searchParams.get('poolId');
  if (!poolId) {
    return NextResponse.json({ error: 'Missing poolId' }, { status: 400 });
  }

  const supabase = createClient();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  // Fetch open proposals, SPO's votes, and pool score in parallel
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
    supabase
      .from('pools')
      .select('governance_score, vote_count, participation_pct, deliberation_pct')
      .eq('pool_id', poolId)
      .single(),
  ]);

  const openProposals = openResult.data ?? [];
  const spoVotes = votesResult.data ?? [];
  const pool = poolResult.data;

  const votedKeys = new Set(spoVotes.map((v) => `${v.proposal_tx_hash}-${v.proposal_index}`));

  // Filter to SPO-votable proposals that haven't been voted on
  const pending = openProposals.filter(
    (p) =>
      SPO_VOTABLE_TYPES.includes(p.proposal_type ?? '') &&
      !votedKeys.has(`${p.tx_hash}-${p.proposal_index}`),
  );

  const pendingCount = pending.length;
  const currentScore = pool?.governance_score ?? 0;
  const currentVoteCount = pool?.vote_count ?? 0;

  // Estimate score impact: approximate gain if SPO votes on all pending with rationale
  // Based on the scoring model: participation (35%) + deliberation (25%) + reliability (25%) + identity (15%)
  // Voting on pending proposals primarily improves participation
  let potentialGain = 0;
  let perProposalGain = 0;

  if (pendingCount > 0 && currentScore < 100) {
    // Count total votable proposals for participation rate estimation
    const totalVotable = openProposals.filter((p) =>
      SPO_VOTABLE_TYPES.includes(p.proposal_type ?? ''),
    ).length;
    const totalProposals = totalVotable + currentVoteCount;

    if (totalProposals > 0) {
      const currentParticipation = pool?.participation_pct ?? 0;
      const simVoteCount = currentVoteCount + pendingCount;
      const simParticipation = Math.min(100, (simVoteCount / totalProposals) * 100);
      const participationGain = (simParticipation - currentParticipation) * 0.35;

      // Deliberation boost from adding rationales (assume all new votes have rationale)
      const currentDeliberation = pool?.deliberation_pct ?? 0;
      const simDeliberation = Math.min(100, currentDeliberation + pendingCount * 2);
      const deliberationGain = (simDeliberation - currentDeliberation) * 0.25;

      potentialGain = Math.max(0, +(participationGain + deliberationGain).toFixed(1));
      perProposalGain = pendingCount > 0 ? +(potentialGain / pendingCount).toFixed(1) : 0;
    }
  }

  // Enrich proposals with priority, deadline, and score impact
  const enriched = pending
    .map((p) => {
      const expiryEpoch = p.expiration_epoch ?? 0;
      const epochsRemaining = expiryEpoch > 0 ? Math.max(0, expiryEpoch - currentEpoch) : null;
      return {
        txHash: p.tx_hash,
        index: p.proposal_index,
        title: getProposalDisplayTitle(p.title, p.tx_hash, p.proposal_index),
        proposalType: p.proposal_type || 'Proposal',
        priority: getProposalPriority(p.proposal_type ?? ''),
        epochsRemaining,
        perProposalScoreImpact: perProposalGain,
      };
    })
    .sort((a, b) => {
      const priorityOrder = { critical: 0, important: 1, standard: 2 };
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return (a.epochsRemaining ?? 999) - (b.epochsRemaining ?? 999);
    });

  const criticalCount = enriched.filter((p) => p.priority === 'critical').length;
  const urgentCount = enriched.filter((p) => (p.epochsRemaining ?? 999) <= 2).length;

  logger.info('SPO inbox served', {
    context: 'dashboard/spo-inbox',
    poolId,
    pendingCount,
    criticalCount,
    urgentCount,
    potentialGain,
  });

  return NextResponse.json({
    pendingProposals: enriched,
    pendingCount,
    currentEpoch,
    scoreImpact: {
      currentScore,
      simulatedScore: Math.min(100, currentScore + potentialGain),
      potentialGain,
      perProposalGain,
    },
    criticalCount,
    urgentCount,
  });
});
