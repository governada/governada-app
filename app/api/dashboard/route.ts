/**
 * DRep Dashboard API
 * Returns full DRep data, votes, score history, and link checks for the
 * authenticated DRep owner's dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  getScoreHistory,
  getSocialLinkChecks,
  getDRepPercentile,
} from '@/lib/data';
import { getProposalDisplayTitle } from '@/utils/display';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const drepId = request.nextUrl.searchParams.get('drepId');
  if (!drepId) {
    return NextResponse.json({ error: 'Missing drepId' }, { status: 400 });
  }

  try {
    const cachedDRep = await getDRepById(drepId);
    if (!cachedDRep) {
      return NextResponse.json({ error: 'DRep not found' }, { status: 404 });
    }

    const [rawVotes, scoreHistory, linkChecks, percentile] = await Promise.all([
      getVotesByDRepId(drepId),
      getScoreHistory(drepId),
      getSocialLinkChecks(drepId),
      getDRepPercentile(cachedDRep.drepScore),
    ]);

    const proposalIds = rawVotes.map((v: any) => ({
      txHash: v.proposal_tx_hash as string,
      index: v.proposal_index as number,
    }));
    const seen = new Set<string>();
    const uniqueProposalIds = proposalIds.filter((p: { txHash: string; index: number }) => {
      const key = `${p.txHash}-${p.index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const [cachedProposals, cachedRationales] = await Promise.all([
      getProposalsByIds(uniqueProposalIds),
      getRationalesByVoteTxHashes(rawVotes.map((v: any) => v.vote_tx_hash)),
    ]);

    const votes = rawVotes.map((vote: any, index: number) => {
      const key = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
      const cachedProposal = cachedProposals.get(key);
      const title = cachedProposal?.title || null;
      const rationaleRecord = cachedRationales.get(vote.vote_tx_hash) ?? null;
      const rationaleText = rationaleRecord?.rationaleText || null;
      const rationaleAiSummary = rationaleRecord?.rationaleAiSummary || null;

      return {
        id: `${vote.vote_tx_hash}-${index}`,
        proposalTxHash: vote.proposal_tx_hash,
        proposalIndex: vote.proposal_index,
        voteTxHash: vote.vote_tx_hash,
        date: new Date(vote.block_time * 1000).toISOString(),
        vote: vote.vote,
        title: getProposalDisplayTitle(title, vote.proposal_tx_hash, vote.proposal_index),
        abstract: cachedProposal?.abstract || null,
        aiSummary: cachedProposal?.aiSummary ?? null,
        hasRationale: vote.meta_url !== null || rationaleText !== null,
        rationaleUrl: vote.meta_url,
        rationaleText,
        rationaleAiSummary,
        voteType: 'Governance' as const,
        proposalType: cachedProposal?.proposalType || null,
        treasuryTier: cachedProposal?.treasuryTier || null,
        withdrawalAmount: cachedProposal?.withdrawalAmount || null,
        relevantPrefs: cachedProposal?.relevantPrefs || [],
      };
    });

    const brokenLinks = linkChecks.filter((c: any) => c.status === 'broken').map((c: any) => c.uri);

    return NextResponse.json({
      drep: {
        drepId: cachedDRep.drepId,
        drepHash: cachedDRep.drepHash,
        handle: cachedDRep.handle,
        name: cachedDRep.name,
        ticker: cachedDRep.ticker,
        description: cachedDRep.description,
        votingPower: cachedDRep.votingPower,
        votingPowerLovelace: cachedDRep.votingPowerLovelace,
        delegatorCount: cachedDRep.delegatorCount,
        sizeTier: cachedDRep.sizeTier,
        drepScore: cachedDRep.drepScore,
        isActive: cachedDRep.isActive,
        participationRate: cachedDRep.participationRate,
        rationaleRate: cachedDRep.rationaleRate,
        effectiveParticipation: cachedDRep.effectiveParticipation,
        deliberationModifier: cachedDRep.deliberationModifier,
        reliabilityScore: cachedDRep.reliabilityScore,
        reliabilityStreak: cachedDRep.reliabilityStreak,
        reliabilityRecency: cachedDRep.reliabilityRecency,
        reliabilityLongestGap: cachedDRep.reliabilityLongestGap,
        reliabilityTenure: cachedDRep.reliabilityTenure,
        profileCompleteness: cachedDRep.profileCompleteness,
        anchorUrl: cachedDRep.anchorUrl,
        metadata: cachedDRep.metadata,
        votes,
        brokenLinks,
        updatedAt: cachedDRep.updatedAt,
      },
      scoreHistory,
      percentile,
    });
  } catch (error) {
    console.error('[MyDRep API] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
