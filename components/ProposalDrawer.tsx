'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, TrendingUp, Clock, FileText, Users, Vote } from 'lucide-react';
import { RationaleAssistant } from '@/components/RationaleAssistant';
import { DelegatorPulse } from '@/components/DelegatorPulse';
import { getProposalTheme } from '@/components/governada/proposals/proposal-theme';

interface ProposalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: {
    txHash: string;
    proposalIndex: number;
    title: string | null;
    abstract: string | null;
    aiSummary: string | null;
    proposalType: string;
    withdrawalAmount: number | null;
    treasuryTier: string | null;
    treasuryPctOfBalance?: number | null;
    priority: 'critical' | 'important' | 'standard';
    epochsRemaining: number | null;
    proposedEpoch: number | null;
    perProposalScoreImpact: number;
    yesCount: number;
    noCount: number;
    abstainCount: number;
    totalVotes: number;
  } | null;
  drepId: string;
}

const PRIORITY_LABELS = {
  critical: {
    label: 'Critical',
    class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  important: {
    label: 'Important',
    class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  standard: {
    label: 'Standard',
    class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export function ProposalDrawer({ open, onOpenChange, proposal, drepId }: ProposalDrawerProps) {
  useEffect(() => {
    if (open && proposal) {
      try {
        posthog?.capture('proposal_drawer_opened', {
          proposalType: proposal.proposalType,
          priority: proposal.priority,
          epochsRemaining: proposal.epochsRemaining,
          drepId,
        });
      } catch {}
    }
  }, [open, proposal, drepId]);

  if (!proposal) return null;

  const totalVotes = proposal.totalVotes;
  const yesPercent = totalVotes > 0 ? Math.round((proposal.yesCount / totalVotes) * 100) : 0;
  const noPercent = totalVotes > 0 ? Math.round((proposal.noCount / totalVotes) * 100) : 0;
  const abstainPercent =
    totalVotes > 0 ? Math.round((proposal.abstainCount / totalVotes) * 100) : 0;
  const priorityConfig = PRIORITY_LABELS[proposal.priority];

  const govToolUrl = `https://gov.tools/governance_actions/${proposal.txHash}#${proposal.proposalIndex}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${priorityConfig.class}`}>
              {priorityConfig.label}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {getProposalTheme(proposal.proposalType).label || proposal.proposalType}
            </Badge>
            {proposal.epochsRemaining != null && (
              <Badge
                variant="outline"
                className={`text-[10px] gap-1 ${
                  proposal.epochsRemaining <= 2
                    ? 'border-red-500/50 text-red-600 dark:text-red-400 bg-red-500/5 animate-pulse'
                    : ''
                }`}
              >
                <Clock className="h-2.5 w-2.5" />
                {proposal.epochsRemaining <= 2
                  ? `Voting closes in ~${proposal.epochsRemaining * 5} days`
                  : `${proposal.epochsRemaining} epoch${proposal.epochsRemaining !== 1 ? 's' : ''} left`}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-base leading-tight">
            {proposal.title || `Proposal ${proposal.txHash.slice(0, 12)}...`}
          </SheetTitle>
          <SheetDescription className="sr-only">Proposal details and voting tools</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {/* Score Impact */}
          {proposal.perProposalScoreImpact > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2.5 border border-green-200 dark:border-green-800">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-xs text-green-800 dark:text-green-300">
                Voting with rationale: estimated{' '}
                <span className="font-semibold">+{proposal.perProposalScoreImpact} pts</span> to
                your score
              </p>
            </div>
          )}

          {/* AI Summary */}
          {proposal.aiSummary && (
            <Section icon={<FileText className="h-4 w-4" />} title="AI Summary" proBadge>
              <p className="text-xs text-muted-foreground leading-relaxed">{proposal.aiSummary}</p>
            </Section>
          )}

          {/* Proposal Details */}
          {proposal.abstract && (
            <Section icon={<FileText className="h-4 w-4" />} title="Abstract">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-6">
                {proposal.abstract}
              </p>
            </Section>
          )}

          {/* Treasury Amount with % framing */}
          {proposal.withdrawalAmount != null && (
            <div className="border rounded-lg px-3 py-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Treasury Amount</span>
                <span className="font-semibold">
                  {proposal.withdrawalAmount.toLocaleString()} ADA
                  {proposal.treasuryTier && (
                    <span className="text-muted-foreground font-normal ml-1">
                      ({proposal.treasuryTier})
                    </span>
                  )}
                </span>
              </div>
              {proposal.treasuryPctOfBalance != null && proposal.treasuryPctOfBalance > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">% of Treasury</span>
                  <span
                    className={`font-semibold ${
                      proposal.treasuryPctOfBalance > 5
                        ? 'text-red-600 dark:text-red-400'
                        : proposal.treasuryPctOfBalance > 1
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {proposal.treasuryPctOfBalance.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Peer Sentiment (aggregates only) */}
          <Section icon={<Users className="h-4 w-4" />} title="DRep Sentiment">
            {totalVotes > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{totalVotes} DReps have voted</span>
                </div>
                <SentimentBar
                  label="Yes"
                  percent={yesPercent}
                  count={proposal.yesCount}
                  color="bg-green-500"
                />
                <SentimentBar
                  label="No"
                  percent={noPercent}
                  count={proposal.noCount}
                  color="bg-red-500"
                />
                <SentimentBar
                  label="Abstain"
                  percent={abstainPercent}
                  count={proposal.abstainCount}
                  color="bg-gray-400"
                />
                <p className="text-[10px] text-muted-foreground pt-1">
                  Individual vote breakdown is visible after you cast your vote.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No DReps have voted on this proposal yet. Check back soon — voting has just begun.
              </p>
            )}
          </Section>

          {/* Delegator Pulse */}
          <DelegatorPulse
            txHash={proposal.txHash}
            proposalIndex={proposal.proposalIndex}
            drepId={drepId}
          />

          {/* Rationale Assistant */}
          <div className="border-t pt-4">
            <RationaleAssistant
              drepId={drepId}
              proposalTitle={proposal.title || `Proposal ${proposal.txHash.slice(0, 12)}`}
              proposalAbstract={proposal.abstract}
              proposalType={proposal.proposalType}
              aiSummary={proposal.aiSummary}
            />
          </div>

          {/* Vote CTA */}
          <div className="border-t pt-4 space-y-2">
            <a
              href={govToolUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                try {
                  posthog?.capture('vote_cta_clicked', {
                    proposalType: proposal.proposalType,
                    priority: proposal.priority,
                    drepId,
                  });
                } catch {}
              }}
            >
              <Button className="w-full gap-2">
                <Vote className="h-4 w-4" />
                Vote on GovTool
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
            <p className="text-[10px] text-muted-foreground text-center">
              Opens GovTool in a new tab where you can submit your vote on-chain.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon,
  title,
  children,
  proBadge,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  proBadge?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-medium">{title}</h3>
        {proBadge && (
          <Badge
            variant="outline"
            className="text-[10px] bg-primary/10 text-primary border-primary/30"
          >
            Pro
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function SentimentBar({
  label,
  percent,
  count,
  color,
}: {
  label: string;
  percent: number;
  count: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({percent}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
