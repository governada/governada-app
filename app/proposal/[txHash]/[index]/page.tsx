import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalByKey, getVotesByProposal } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { getTreasuryBalance } from '@/lib/treasury';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProposalDescription } from '@/components/ProposalDescription';
import { ProposalAiSummary } from '@/components/ProposalAiSummary';
import { ThresholdMeter } from '@/components/ThresholdMeter';
import { VoteTimeline } from '@/components/VoteTimeline';
import { ArrowLeft } from 'lucide-react';
import { getProposalStatus } from '@/utils/proposalPriority';
import { ProposalOutcomeSection } from '@/components/ProposalOutcomeSection';
import { ProposalVoterTabs } from '@/components/ProposalVoterTabs';
import { SimilarProposals } from '@/components/SimilarProposals';
import { PageViewTracker } from '@/components/PageViewTracker';
import { ProposalHeroV1 } from '@/components/civica/proposals/ProposalHeroV1';
import { VoteAdoptionCurve } from '@/components/civica/charts/VoteAdoptionCurve';
import { ProposalDimensionTags } from '@/components/civica/proposals/ProposalDimensionTags';
import { ProposalTopRationales } from '@/components/civica/proposals/ProposalTopRationales';
import { ProposalLifecycleTimeline } from '@/components/civica/proposals/ProposalLifecycleTimeline';
import { ParamChangesCard } from '@/components/civica/proposals/ParamChangesCard';
import { AlignmentCohortBreakdown } from '@/components/civica/proposals/AlignmentCohortBreakdown';
import { VoteCastingPanel } from '@/components/civica/proposals/VoteCastingPanel';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ txHash: string; index: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);
  const proposal = isNaN(proposalIndex) ? null : await getProposalByKey(txHash, proposalIndex);
  const title = proposal?.title || `Proposal ${txHash.slice(0, 12)}...`;
  return {
    title: `${title} — Civica`,
    description: `Governance proposal details, votes, and analysis on Civica.`,
  };
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);

  if (isNaN(proposalIndex)) notFound();

  const [proposal, votes, treasury] = await Promise.all([
    getProposalByKey(txHash, proposalIndex),
    getVotesByProposal(txHash, proposalIndex),
    getTreasuryBalance(),
  ]);

  if (!proposal) notFound();

  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  const status = getProposalStatus(proposal);
  const isOpen = status === 'open';

  const timelineVotes = votes.map((v) => ({
    drepName: v.drepName,
    drepId: v.drepId,
    vote: v.vote,
    blockTime: v.blockTime,
  }));

  // Aggregate votes by epoch for adoption curve
  const votesByEpoch = new Map<number, { yes: number; no: number; abstain: number }>();
  for (const v of votes) {
    const epoch = v.blockTime ? blockTimeToEpoch(v.blockTime) : null;
    if (epoch == null) continue;
    const bucket = votesByEpoch.get(epoch) ?? { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') bucket.yes++;
    else if (v.vote === 'No') bucket.no++;
    else bucket.abstain++;
    votesByEpoch.set(epoch, bucket);
  }
  const adoptionData = [...votesByEpoch.entries()]
    .sort(([a], [b]) => a - b)
    .map(([epoch, counts]) => ({
      epoch,
      yesCount: counts.yes,
      noCount: counts.no,
      abstainCount: counts.abstain,
    }));

  // Build rationale entries for the top-rationales card
  const rationaleEntries = votes
    .filter((v) => v.rationaleAiSummary || v.rationaleText)
    .map((v) => ({
      drepId: v.drepId,
      drepName: v.drepName,
      vote: v.vote,
      rationaleText: v.rationaleText,
      rationaleAiSummary: v.rationaleAiSummary,
      hashVerified: v.hashVerified,
    }));

  const title = proposal.title || `Proposal ${txHash.slice(0, 12)}...`;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker
        event="proposal_detail_viewed"
        properties={{ tx_hash: txHash, index: proposalIndex }}
      />

      <Link href="/discover">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          All Proposals
        </Button>
      </Link>

      {/* VP1 Hero */}
      <ProposalHeroV1
        txHash={txHash}
        proposalIndex={proposalIndex}
        title={title}
        proposalType={proposal.proposalType}
        status={status}
        withdrawalAmount={proposal.withdrawalAmount}
        treasuryBalanceAda={treasury?.balanceAda ?? null}
        treasuryTier={proposal.treasuryTier}
        proposedEpoch={proposal.proposedEpoch}
        expirationEpoch={proposal.expirationEpoch}
        ratifiedEpoch={proposal.ratifiedEpoch}
        enactedEpoch={proposal.enactedEpoch}
        droppedEpoch={proposal.droppedEpoch}
        expiredEpoch={proposal.expiredEpoch}
        currentEpoch={currentEpoch}
        triBody={proposal.triBody ?? null}
        blockTime={proposal.blockTime}
      />

      {/* Governance dimension tags */}
      <ProposalDimensionTags relevantPrefs={proposal.relevantPrefs} />

      {/* Lifecycle Timeline */}
      <ProposalLifecycleTimeline
        proposedEpoch={proposal.proposedEpoch}
        expirationEpoch={proposal.expirationEpoch}
        ratifiedEpoch={proposal.ratifiedEpoch}
        enactedEpoch={proposal.enactedEpoch}
        droppedEpoch={proposal.droppedEpoch}
        expiredEpoch={proposal.expiredEpoch}
        currentEpoch={currentEpoch}
      />

      {/* Parameter Changes (ParameterChange proposals only) */}
      {proposal.proposalType === 'ParameterChange' && proposal.paramChanges && (
        <ParamChangesCard paramChanges={proposal.paramChanges} />
      )}

      {/* Vote Casting (DReps only, open proposals only) */}
      <VoteCastingPanel
        txHash={txHash}
        proposalIndex={proposalIndex}
        title={title}
        isOpen={isOpen}
      />

      {/* VP2 stack */}

      {/* 1. AI Summary */}
      <ProposalAiSummary summary={proposal.aiSummary} />

      {/* 2. Full Description */}
      <ProposalDescription aiSummary={null} abstract={proposal.abstract} />

      {/* 3. Threshold Meter */}
      <Card>
        <CardHeader>
          <CardTitle>DRep Voting Power</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ThresholdMeter
            txHash={txHash}
            proposalIndex={proposalIndex}
            proposalType={proposal.proposalType}
            yesCount={proposal.yesCount}
            noCount={proposal.noCount}
            abstainCount={proposal.abstainCount}
            totalVotes={proposal.totalVotes}
            isOpen={isOpen}
            variant="full"
          />
          <p className="text-sm text-muted-foreground text-center">
            {proposal.totalVotes} DReps voted on this proposal
          </p>
        </CardContent>
      </Card>

      {/* 3b. Vote Adoption Curve */}
      {adoptionData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Vote Adoption</CardTitle>
          </CardHeader>
          <CardContent>
            <VoteAdoptionCurve votes={adoptionData} />
          </CardContent>
        </Card>
      )}

      {/* 4. Alignment Cohort Breakdown */}
      <AlignmentCohortBreakdown votes={votes} />

      {/* 5. What Representatives Are Saying (real rationales) */}
      <ProposalTopRationales rationales={rationaleEntries} />

      {/* 6. Vote Timeline */}
      <VoteTimeline
        votes={timelineVotes}
        proposalBlockTime={proposal.blockTime || 0}
        expirationEpoch={proposal.expirationEpoch}
        currentEpoch={currentEpoch}
      />

      {/* 7. Voter Tabs */}
      <ProposalVoterTabs votes={votes} txHash={txHash} proposalIndex={proposalIndex} />

      {/* 8. Similar Proposals */}
      <SimilarProposals txHash={txHash} proposalIndex={proposalIndex} />

      {/* 9. Outcome (closed proposals only) */}
      {!isOpen && (
        <ProposalOutcomeSection
          proposal={{
            txHash,
            proposalIndex,
            title,
            proposalType: proposal.proposalType,
            withdrawalAmount: proposal.withdrawalAmount,
            outcome: status as 'ratified' | 'enacted' | 'dropped' | 'expired',
          }}
          votes={votes.map((v) => ({ drepId: v.drepId, vote: v.vote }))}
          majorityVote={
            proposal.yesCount >= proposal.noCount && proposal.yesCount >= proposal.abstainCount
              ? 'Yes'
              : proposal.noCount >= proposal.abstainCount
                ? 'No'
                : 'Abstain'
          }
        />
      )}
    </div>
  );
}
