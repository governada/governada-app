import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalByKey, getVotesByProposal } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { ProposalVotersWithContext } from '@/components/ProposalVotersWithContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProposalDescription } from '@/components/ProposalDescription';
import { ProposalAiSummary } from '@/components/ProposalAiSummary';
import { ThresholdMeter } from '@/components/ThresholdMeter';
import { VoteTimeline } from '@/components/VoteTimeline';
import { ArrowLeft, ExternalLink, Shield, Zap, Landmark, Eye, Scale } from 'lucide-react';
import {
  ProposalStatusBadge,
  PriorityBadge,
  DeadlineBadge,
  TreasuryTierBadge,
  TypeExplainerTooltip,
} from '@/components/ProposalStatusBadge';
import { getProposalStatus } from '@/utils/proposalPriority';
import { DRepVoteCallout } from '@/components/DRepVoteCallout';
import { SentimentPoll } from '@/components/SentimentPoll';
import { ProposalOutcomeSection } from '@/components/ProposalOutcomeSection';

interface ProposalDetailPageProps {
  params: Promise<{ txHash: string; index: string }>;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark; color: string }> = {
  TreasuryWithdrawals: { label: 'Treasury Withdrawal', icon: Landmark, color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  ParameterChange: { label: 'Parameter Change', icon: Shield, color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  HardForkInitiation: { label: 'Hard Fork Initiation', icon: Zap, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  InfoAction: { label: 'Info Action', icon: Eye, color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  NoConfidence: { label: 'No Confidence', icon: Scale, color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30' },
  NewCommittee: { label: 'Constitutional Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  NewConstitutionalCommittee: { label: 'Constitutional Committee', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  NewConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  UpdateConstitution: { label: 'Constitution', icon: Scale, color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' },
};

export default async function ProposalDetailPage({ params }: ProposalDetailPageProps) {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);

  if (isNaN(proposalIndex)) notFound();

  const [proposal, votes] = await Promise.all([
    getProposalByKey(txHash, proposalIndex),
    getVotesByProposal(txHash, proposalIndex),
  ]);

  if (!proposal) notFound();

  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  const config = TYPE_CONFIG[proposal.proposalType];
  const TypeIcon = config?.icon;

  const status = getProposalStatus(proposal);
  const isOpen = status === 'open';

  const date = proposal.blockTime
    ? new Date(proposal.blockTime * 1000).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  const timelineVotes = votes.map(v => ({
    drepName: v.drepName,
    drepId: v.drepId,
    vote: v.vote,
    blockTime: v.blockTime,
  }));

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/proposals">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          All Proposals
        </Button>
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <ProposalStatusBadge
            ratifiedEpoch={proposal.ratifiedEpoch}
            enactedEpoch={proposal.enactedEpoch}
            droppedEpoch={proposal.droppedEpoch}
            expiredEpoch={proposal.expiredEpoch}
          />
          <PriorityBadge proposalType={proposal.proposalType} />
          {config && (
            <Badge variant="outline" className={`gap-1 ${config.color}`}>
              {TypeIcon && <TypeIcon className="h-3.5 w-3.5" />}
              {config.label}
            </Badge>
          )}
          <TypeExplainerTooltip proposalType={proposal.proposalType} />
          {proposal.treasuryTier && (
            <TreasuryTierBadge tier={proposal.treasuryTier} />
          )}
          {proposal.proposedEpoch && (
            <Badge variant="secondary">Epoch {proposal.proposedEpoch}</Badge>
          )}
          <DeadlineBadge expirationEpoch={proposal.expirationEpoch} currentEpoch={currentEpoch} />
        </div>

        <h1 className="text-2xl font-bold">
          {proposal.title || `Proposal ${txHash.slice(0, 12)}...`}
        </h1>

        <div className="flex items-center gap-3 flex-wrap">
          {date && (
            <p className="text-sm text-muted-foreground">Proposed {date}</p>
          )}
          <a
            href={`https://gov.tools/governance_actions/${txHash}#${proposalIndex}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View on GovTool <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {proposal.withdrawalAmount && (
          <p className="text-sm font-medium">
            Withdrawal: {proposal.withdrawalAmount.toLocaleString()} ADA
          </p>
        )}
      </div>

      {/* AI Summary - immediately after header for at-a-glance understanding */}
      <ProposalAiSummary summary={proposal.aiSummary} />

      {/* DRep Vote Callout */}
      <DRepVoteCallout txHash={txHash} proposalIndex={proposalIndex} />

      {/* Community Sentiment Poll */}
      <SentimentPoll txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />

      {/* Proposal Outcome Card — only for closed proposals */}
      {!isOpen && (
        <ProposalOutcomeSection
          proposal={{
            txHash,
            proposalIndex,
            title: proposal.title || `Proposal ${txHash.slice(0, 12)}...`,
            proposalType: proposal.proposalType,
            withdrawalAmount: proposal.withdrawalAmount,
            outcome: (status as 'ratified' | 'enacted' | 'dropped' | 'expired'),
          }}
          votes={votes.map(v => ({ drepId: v.drepId, vote: v.vote }))}
          majorityVote={
            proposal.yesCount >= proposal.noCount && proposal.yesCount >= proposal.abstainCount
              ? 'Yes'
              : proposal.noCount >= proposal.abstainCount
                ? 'No'
                : 'Abstain'
          }
        />
      )}

      {/* Full Description (abstract) */}
      <ProposalDescription aiSummary={null} abstract={proposal.abstract} />

      {/* Vote Results with Threshold Meter */}
      <Card>
        <CardHeader>
          <CardTitle>Vote Results</CardTitle>
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

      {/* Vote Timeline */}
      <VoteTimeline
        votes={timelineVotes}
        proposalBlockTime={proposal.blockTime || 0}
        expirationEpoch={proposal.expirationEpoch}
        currentEpoch={currentEpoch}
      />

      {/* DRep Voters */}
      <ProposalVotersWithContext votes={votes} />

    </div>
  );
}
