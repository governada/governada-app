import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProposalByKey, getVotesByProposal } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProposalDescription } from '@/components/ProposalDescription';
import { ProposalAiSummary } from '@/components/ProposalAiSummary';
import { ThresholdMeter } from '@/components/ThresholdMeter';
import { VoteTimeline } from '@/components/VoteTimeline';
import {
  ArrowLeft,
  ExternalLink,
  Shield,
  Zap,
  Landmark,
  Eye,
  Scale,
  MessageSquare,
} from 'lucide-react';
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
import { TriBodyVotePanel } from '@/components/TriBodyVotePanel';
import { ProposalVoterTabs } from '@/components/ProposalVoterTabs';
import { SimilarProposals } from '@/components/SimilarProposals';
import { PageViewTracker } from '@/components/PageViewTracker';
import { getFeatureFlag } from '@/lib/featureFlags';
import { ProposalHeroV1 } from '@/components/civica/proposals/ProposalHeroV1';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ txHash: string; index: string }>;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark; color: string }> = {
  TreasuryWithdrawals: {
    label: 'Treasury Withdrawal',
    icon: Landmark,
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  ParameterChange: {
    label: 'Parameter Change',
    icon: Shield,
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  HardForkInitiation: {
    label: 'Hard Fork Initiation',
    icon: Zap,
    color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  },
  InfoAction: {
    label: 'Info Action',
    icon: Eye,
    color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  NoConfidence: {
    label: 'No Confidence',
    icon: Scale,
    color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  },
  NewCommittee: {
    label: 'Constitutional Committee',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  NewConstitutionalCommittee: {
    label: 'Constitutional Committee',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  NewConstitution: {
    label: 'Constitution',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  UpdateConstitution: {
    label: 'Constitution',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);
  const proposal = isNaN(proposalIndex) ? null : await getProposalByKey(txHash, proposalIndex);
  const title = proposal?.title || `Proposal ${txHash.slice(0, 12)}...`;
  return {
    title: `${title} — DRepScore`,
    description: `Governance proposal details, votes, and analysis on DRepScore.`,
  };
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);

  if (isNaN(proposalIndex)) notFound();

  const [proposal, votes, civicaEnabled] = await Promise.all([
    getProposalByKey(txHash, proposalIndex),
    getVotesByProposal(txHash, proposalIndex),
    getFeatureFlag('civica_frontend'),
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

  const title = proposal.title || `Proposal ${txHash.slice(0, 12)}...`;

  if (civicaEnabled) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <PageViewTracker
          event="proposal_detail_viewed"
          properties={{ tx_hash: txHash, index: proposalIndex }}
        />

        {/* Back */}
        <Link href="/proposals">
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

        {/* 4. Representative comments scaffold (Phase 3D) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              What representatives are saying
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No representatives have commented on this proposal yet.
            </p>
          </CardContent>
        </Card>

        {/* 5. Vote Timeline */}
        <VoteTimeline
          votes={timelineVotes}
          proposalBlockTime={proposal.blockTime || 0}
          expirationEpoch={proposal.expirationEpoch}
          currentEpoch={currentEpoch}
        />

        {/* 6. Voter Tabs */}
        <ProposalVoterTabs votes={votes} txHash={txHash} proposalIndex={proposalIndex} />

        {/* 7. Similar Proposals */}
        <SimilarProposals txHash={txHash} proposalIndex={proposalIndex} />

        {/* 8. Outcome (closed proposals only) */}
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

  // Non-civica fallback — identical layout to app/proposals/[txHash]/[index]/page.tsx
  const config = TYPE_CONFIG[proposal.proposalType];
  const TypeIcon = config?.icon;

  const date = proposal.blockTime
    ? new Date(proposal.blockTime * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker
        event="proposal_detail_viewed"
        properties={{ tx_hash: txHash, index: proposalIndex }}
      />
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
          {proposal.treasuryTier && <TreasuryTierBadge tier={proposal.treasuryTier} />}
          {proposal.proposedEpoch && (
            <Badge variant="secondary">Epoch {proposal.proposedEpoch}</Badge>
          )}
          <DeadlineBadge expirationEpoch={proposal.expirationEpoch} currentEpoch={currentEpoch} />
        </div>

        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {date && <p className="text-sm text-muted-foreground">Proposed {date}</p>}
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

      <ProposalAiSummary summary={proposal.aiSummary} />
      <DRepVoteCallout txHash={txHash} proposalIndex={proposalIndex} />
      <SentimentPoll txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />

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

      <ProposalDescription aiSummary={null} abstract={proposal.abstract} />

      {proposal.triBody && (
        <TriBodyVotePanel
          triBody={proposal.triBody}
          txHash={txHash}
          proposalIndex={proposalIndex}
        />
      )}

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

      <VoteTimeline
        votes={timelineVotes}
        proposalBlockTime={proposal.blockTime || 0}
        expirationEpoch={proposal.expirationEpoch}
        currentEpoch={currentEpoch}
      />

      <ProposalVoterTabs votes={votes} txHash={txHash} proposalIndex={proposalIndex} />
      <SimilarProposals txHash={txHash} proposalIndex={proposalIndex} />
    </div>
  );
}
