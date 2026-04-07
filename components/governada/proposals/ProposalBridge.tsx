'use client';

import Link from 'next/link';
import { Vote, CheckCircle2, Wallet } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CitizenSentimentReaction } from './CitizenSentimentReaction';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CITIZEN_PROPOSAL_ACTION_ID,
  getProposalConnectHref,
  getProposalGovernanceActionMessage,
  getProposalGovernanceActionState,
  getProposalWorkspaceReviewHref,
} from '@/lib/navigation/proposalAction';

interface ProposalBridgeProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalType?: string | null;
  paramChanges?: Record<string, unknown> | null;
  existingVote?: string | null;
}

/**
 * Bridge component that routes users from discovery (proposal detail)
 * to the appropriate action layer:
 * - DRep/SPO/CC: "Review & Vote" link to workspace
 * - Citizen: inline sentiment reaction
 * - Anonymous: wallet-connect CTA + read-only results
 */
export function ProposalBridge({
  txHash,
  proposalIndex,
  title: _title,
  isOpen,
  proposalType,
  paramChanges,
  existingVote,
}: ProposalBridgeProps) {
  const { segment, isLoading } = useSegment();

  if (isLoading) {
    return <Skeleton className="h-14 w-full rounded-xl" />;
  }

  const actionState = getProposalGovernanceActionState(segment, isOpen, proposalType, paramChanges);

  // Governance actors: show review & vote button
  if (actionState.isGovernanceActor) {
    const workspaceUrl = getProposalWorkspaceReviewHref(txHash, proposalIndex);

    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border px-4 py-3',
          'bg-card/50 backdrop-blur-sm',
        )}
      >
        {existingVote ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                You voted{' '}
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs ml-1',
                    existingVote === 'Yes' && 'border-emerald-500/40 text-emerald-500',
                    existingVote === 'No' && 'border-red-500/40 text-red-500',
                    existingVote === 'Abstain' && 'border-amber-500/40 text-amber-500',
                  )}
                >
                  {existingVote}
                </Badge>
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={workspaceUrl}>Change vote</Link>
            </Button>
          </>
        ) : actionState.canVote ? (
          <>
            <Vote className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Ready to decide?</p>
              <p className="text-xs text-muted-foreground truncate">
                Review and cast your vote in the workspace
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={workspaceUrl}>Review &amp; Vote</Link>
            </Button>
          </>
        ) : (
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              {getProposalGovernanceActionMessage(actionState)}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Citizen: inline sentiment
  if (segment === 'citizen') {
    return (
      <div
        id={CITIZEN_PROPOSAL_ACTION_ID}
        className="rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 space-y-2"
      >
        <p className="text-xs font-medium text-muted-foreground">How do you feel about this?</p>
        <CitizenSentimentReaction txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />
      </div>
    );
  }

  // Anonymous: CTA + read-only results
  return (
    <div className="rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <Link
            className="text-primary font-medium hover:underline"
            href={getProposalConnectHref(txHash, proposalIndex)}
          >
            Connect your wallet
          </Link>{' '}
          to share your view
        </p>
      </div>
      <CitizenSentimentReaction
        txHash={txHash}
        proposalIndex={proposalIndex}
        isOpen={isOpen}
        readOnly
      />
    </div>
  );
}
