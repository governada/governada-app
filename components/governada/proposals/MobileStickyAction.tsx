'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquareHeart, Vote, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { cn } from '@/lib/utils';
import {
  CITIZEN_PROPOSAL_ACTION_ID,
  getProposalConnectHref,
  getProposalGovernanceActionState,
  getProposalWorkspaceReviewHref,
} from '@/lib/navigation/proposalAction';

interface MobileStickyActionProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
  verdictLabel: string;
  verdictColor: string;
  proposalType?: string | null;
  paramChanges?: Record<string, unknown> | null;
}

function StickyButton({
  segment,
  txHash,
  proposalIndex,
  isOpen,
  proposalType,
  paramChanges,
}: {
  segment: UserSegment;
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
  proposalType?: string | null;
  paramChanges?: Record<string, unknown> | null;
}) {
  const actionState = getProposalGovernanceActionState(segment, isOpen, proposalType, paramChanges);
  const workspaceUrl = getProposalWorkspaceReviewHref(txHash, proposalIndex);

  if (actionState.isGovernanceActor) {
    if (!actionState.canVote) {
      return (
        <Button size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none" disabled>
          <Vote className="h-3.5 w-3.5" />
          {actionState.reason === 'closed' ? 'Voting Closed' : 'Not Eligible'}
        </Button>
      );
    }

    return (
      <Button asChild size="sm" className="gap-1.5 flex-1 sm:flex-none">
        <Link href={workspaceUrl}>
          <Vote className="h-3.5 w-3.5" />
          Review &amp; Vote
        </Link>
      </Button>
    );
  }

  if (segment === 'citizen') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 flex-1 sm:flex-none"
        onClick={() => {
          const el = document.getElementById(CITIZEN_PROPOSAL_ACTION_ID);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        <MessageSquareHeart className="h-3.5 w-3.5" />
        Signal
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none" asChild>
      <Link href={getProposalConnectHref(txHash, proposalIndex)}>
        <Wallet className="h-3.5 w-3.5" />
        Connect
      </Link>
    </Button>
  );
}

/**
 * Sticky bottom bar that appears on scroll for mobile users.
 * Shows verdict label + action button and follows the same action contract
 * as the main proposal-detail surface.
 */
export function MobileStickyAction({
  txHash,
  proposalIndex,
  isOpen,
  verdictLabel,
  verdictColor,
  proposalType,
  paramChanges,
}: MobileStickyActionProps) {
  const { segment } = useSegment();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  if (!isOpen || !visible) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 sm:hidden',
        'border-t border-border/50 bg-background/95 backdrop-blur-md',
        'px-4 py-3 safe-area-inset-bottom',
        'transition-transform duration-200',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-sm font-semibold', verdictColor)}>{verdictLabel}</span>
        <StickyButton
          segment={segment}
          txHash={txHash}
          proposalIndex={proposalIndex}
          isOpen={isOpen}
          proposalType={proposalType}
          paramChanges={paramChanges}
        />
      </div>
    </div>
  );
}
