'use client';

/**
 * SubmissionSuccess — shown after a successful governance action submission.
 *
 * Displays the transaction hash, anchor URL, "what happens next" guidance,
 * and action buttons to return to portfolio or share the result.
 */

import { useState, useCallback } from 'react';
import { Check, ExternalLink, ArrowRight, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProposalType } from '@/lib/workspace/types';
import { getDraftVotingGuidance } from '@/lib/governance/votingGuidance';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SubmissionSuccessProps {
  txHash: string;
  anchorUrl: string;
  proposalTitle: string;
  proposalType: ProposalType;
  typeSpecific?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SubmissionSuccess({
  txHash,
  anchorUrl,
  proposalTitle,
  proposalType,
  typeSpecific,
}: SubmissionSuccessProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const guidance = getDraftVotingGuidance(proposalType, typeSpecific);

  const cardanoscanUrl = `https://cardanoscan.io/transaction/${txHash}`;

  const handleCopyLink = useCallback(() => {
    const shareText = `I just submitted "${proposalTitle}" as a governance action on Cardano!\n\n${cardanoscanUrl}`;
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [proposalTitle, cardanoscanUrl]);

  const handleReturnToPortfolio = useCallback(() => {
    router.push('/workspace/author');
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Celebration header */}
      <div className="text-center py-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-[var(--compass-teal)]/15 flex items-center justify-center mb-4">
          <Check className="h-7 w-7 text-[var(--compass-teal)]" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground mb-2">
          Your proposal is now on-chain!
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          &ldquo;{proposalTitle}&rdquo; has been submitted as a governance action.
        </p>
      </div>

      {/* Transaction details */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono text-foreground">{truncateHash(txHash)}</code>
            <a
              href={cardanoscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-[var(--compass-teal)] transition-colors"
              aria-label="View on CardanoScan"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Anchor URL</p>
          <a
            href={anchorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[var(--compass-teal)] hover:underline break-all"
          >
            {anchorUrl}
          </a>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Type</p>
          <Badge variant="outline">{proposalType}</Badge>
        </div>
      </div>

      {/* What happens next */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">What Happens Next</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--compass-teal)] shrink-0" />
            <span>{guidance.postSubmissionSummary}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--compass-teal)] shrink-0" />
            <span>Voting period: ~6 epochs (~30 days)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--compass-teal)] shrink-0" />
            <span>You&apos;ll see voting progress in your portfolio</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--compass-teal)] shrink-0" />
            <span>Deposit returned on ratification or expiry</span>
          </li>
        </ul>
      </div>

      {/* Portfolio note */}
      <p className="text-xs text-muted-foreground text-center">
        Track voting progress and view the outcome debrief in your portfolio.
      </p>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleCopyLink} className="flex-1">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </>
          )}
        </Button>
        <Button onClick={handleReturnToPortfolio} className="flex-1">
          Return to Portfolio
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
