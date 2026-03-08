'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShareActions } from '@/components/ShareActions';
import { posthog } from '@/lib/posthog';
import { ProposalDeliveryBadge } from '@/components/civica/proposals/ProposalDeliveryBadge';
import type { DeliveryStatus } from '@/lib/proposalOutcomes';

type Outcome = 'ratified' | 'enacted' | 'dropped' | 'expired';

interface ProposalOutcomeCardProps {
  proposal: {
    txHash: string;
    proposalIndex: number;
    title: string;
    proposalType: string;
    withdrawalAmount?: number | null;
    outcome: Outcome;
  };
  drepVote?: string | null;
  isWinner?: boolean;
  deliveryStatus?: DeliveryStatus | null;
  deliveryScore?: number | null;
}

const OUTCOME_CONFIG: Record<Outcome, { label: string; className: string }> = {
  ratified: {
    label: 'PASSED',
    className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40',
  },
  enacted: {
    label: 'ENACTED',
    className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/40',
  },
  dropped: {
    label: 'DROPPED',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40',
  },
  expired: {
    label: 'EXPIRED',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function ProposalOutcomeCard({
  proposal,
  drepVote,
  isWinner,
  deliveryStatus,
  deliveryScore,
}: ProposalOutcomeCardProps) {
  const config = OUTCOME_CONFIG[proposal.outcome];
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/proposals/${proposal.txHash}/${proposal.proposalIndex}`;

  useEffect(() => {
    posthog.capture('proposal_outcome_card_viewed', {
      outcome: proposal.outcome,
      isWinner,
      proposalType: proposal.proposalType,
    });
  }, [proposal.outcome, proposal.proposalType, isWinner]);

  const shareText = `Proposal "${proposal.title}" was ${config.label.toLowerCase()}${drepVote ? ` — my DRep voted ${drepVote}` : ''}. Check it out on DRepScore!`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 space-y-4">
        {/* Outcome badge + delivery status */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant="outline"
            className={`text-lg px-4 py-1.5 font-bold tracking-wide ${config.className}`}
          >
            {config.label}
          </Badge>
          {deliveryStatus && deliveryStatus !== 'unknown' && (
            <ProposalDeliveryBadge status={deliveryStatus} score={deliveryScore} />
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold leading-snug">
          {proposal.title || `Proposal ${proposal.txHash.slice(0, 12)}...`}
        </h3>

        {/* Treasury withdrawal amount */}
        {proposal.withdrawalAmount != null && proposal.withdrawalAmount > 0 && (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {proposal.withdrawalAmount.toLocaleString()} ADA from the treasury
          </p>
        )}

        {/* DRep vote alignment */}
        {drepVote && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Your DRep voted <span className="font-semibold text-foreground">{drepVote}</span>
            </p>
            {isWinner != null && (
              <p
                className={`text-sm font-medium ${isWinner ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                {isWinner ? 'You were part of the winning majority' : 'You were in the minority'}
              </p>
            )}
          </div>
        )}

        {/* Share actions */}
        <ShareActions
          url={shareUrl}
          text={shareText}
          surface="proposal_outcome"
          metadata={{ outcome: proposal.outcome, isWinner }}
        />
      </CardContent>
    </Card>
  );
}
