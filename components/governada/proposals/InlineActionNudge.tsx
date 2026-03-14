'use client';

import Link from 'next/link';
import { Vote, MessageSquareHeart, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { cn } from '@/lib/utils';

interface InlineActionNudgeProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalType: string;
}

function getGovToolUrl(txHash: string, proposalIndex: number): string {
  return `https://gov.tools/governance_actions/${txHash}#${proposalIndex}`;
}

interface NudgeConfig {
  message: string;
  buttonLabel: string;
  buttonIcon: typeof Vote;
  href: string | null;
  variant: 'vote' | 'signal' | 'connect';
}

function getNudgeConfig(
  segment: UserSegment,
  txHash: string,
  proposalIndex: number,
): NudgeConfig | null {
  switch (segment) {
    case 'drep':
      return {
        message: "You haven't voted on this proposal",
        buttonLabel: 'Cast Your Vote',
        buttonIcon: Vote,
        href: getGovToolUrl(txHash, proposalIndex),
        variant: 'vote',
      };
    case 'spo':
      return {
        message: 'Your pool can vote on this proposal',
        buttonLabel: 'Cast SPO Vote',
        buttonIcon: Vote,
        href: getGovToolUrl(txHash, proposalIndex),
        variant: 'vote',
      };
    case 'cc':
      return {
        message: 'Committee vote pending on this proposal',
        buttonLabel: 'Cast CC Vote',
        buttonIcon: Vote,
        href: getGovToolUrl(txHash, proposalIndex),
        variant: 'vote',
      };
    case 'citizen':
      return {
        message: 'Share your perspective on this proposal',
        buttonLabel: 'Signal',
        buttonIcon: MessageSquareHeart,
        href: null, // handled inline — scrolls to engagement section
        variant: 'signal',
      };
    case 'anonymous':
      return {
        message: 'Connect your wallet to participate',
        buttonLabel: 'Connect Wallet',
        buttonIcon: Wallet,
        href: null,
        variant: 'connect',
      };
    default:
      return null;
  }
}

export function InlineActionNudge({
  txHash,
  proposalIndex,
  title: _title,
  isOpen,
  proposalType: _proposalType,
}: InlineActionNudgeProps) {
  const { segment } = useSegment();

  // Hidden for closed proposals
  if (!isOpen) return null;

  const config = getNudgeConfig(segment, txHash, proposalIndex);
  if (!config) return null;

  const Icon = config.buttonIcon;

  const bgClass =
    config.variant === 'vote'
      ? 'bg-primary/5 border-primary/20'
      : config.variant === 'signal'
        ? 'bg-amber-500/5 border-amber-500/20'
        : 'bg-muted/50 border-border/50';

  const handleSignalClick = () => {
    // Scroll to citizen engagement section
    const el = document.getElementById('citizen-engagement');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-2.5 flex items-center justify-between gap-3',
        bgClass,
      )}
    >
      <span className="text-sm text-foreground/80">{config.message}</span>

      {config.href ? (
        <Button asChild size="sm" variant="default" className="gap-1.5 shrink-0">
          <Link href={config.href} target="_blank" rel="noopener noreferrer">
            <Icon className="h-3.5 w-3.5" />
            {config.buttonLabel}
          </Link>
        </Button>
      ) : config.variant === 'signal' ? (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={handleSignalClick}
        >
          <Icon className="h-3.5 w-3.5" />
          {config.buttonLabel}
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" asChild>
          <Link href="#connect-wallet">
            <Icon className="h-3.5 w-3.5" />
            {config.buttonLabel}
          </Link>
        </Button>
      )}
    </div>
  );
}
