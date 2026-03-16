'use client';

import { CheckCircle2, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PostVoteShareProps {
  txHash: string;
  voteTxHash: string;
  onNext: () => void;
  hasNext: boolean;
}

/**
 * PostVoteShare — shown after a successful vote.
 * PR 3 will add the share card / OG image integration.
 */
export function PostVoteShare({ voteTxHash, onNext, hasNext }: PostVoteShareProps) {
  return (
    <div className="flex items-center justify-between pt-2">
      <a
        href={`https://cardanoscan.io/transaction/${voteTxHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        View on CardanoScan
        <ExternalLink className="h-3 w-3" />
      </a>
      {hasNext && (
        <Button onClick={onNext} variant="outline" size="sm" className="gap-2">
          Next Proposal
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
