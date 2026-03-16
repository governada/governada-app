'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Vote, MessageSquareHeart, Wallet, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { cn } from '@/lib/utils';

interface MobileStickyActionProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
  verdictLabel: string;
  verdictColor: string;
}

function getGovToolUrl(txHash: string, proposalIndex: number): string {
  return `https://gov.tools/governance_actions/${txHash}#${proposalIndex}`;
}

function StickyButton({
  segment,
  txHash,
  proposalIndex,
}: {
  segment: UserSegment;
  txHash: string;
  proposalIndex: number;
}) {
  const govToolUrl = getGovToolUrl(txHash, proposalIndex);

  if (segment === 'drep' || segment === 'spo' || segment === 'cc') {
    return (
      <Button asChild size="sm" className="gap-1.5 flex-1 sm:flex-none">
        <Link href={govToolUrl} target="_blank" rel="noopener noreferrer">
          <Vote className="h-3.5 w-3.5" />
          Cast Vote
          <ExternalLink className="h-3 w-3 opacity-50" />
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
          const el = document.getElementById('citizen-engagement');
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
      <Link href="#connect-wallet">
        <Wallet className="h-3.5 w-3.5" />
        Connect
      </Link>
    </Button>
  );
}

/**
 * Sticky bottom bar that appears on scroll for mobile users.
 * Shows verdict label + action button — always reachable.
 */
export function MobileStickyAction({
  txHash,
  proposalIndex,
  isOpen,
  verdictLabel,
  verdictColor,
}: MobileStickyActionProps) {
  const { segment } = useSegment();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const onScroll = () => {
      // Show after scrolling 400px (past the verdict strip)
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
        <StickyButton segment={segment} txHash={txHash} proposalIndex={proposalIndex} />
      </div>
    </div>
  );
}
