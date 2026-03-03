'use client';

import { VoteRecord, VoteAlignment, UserPrefKey } from '@/types/drep';
import { evaluateVoteAlignment } from '@/lib/alignment';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Copy,
  Check,
  Shield,
  Zap,
  Landmark,
  Eye,
  Scale,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { MarkdownContent } from '@/components/MarkdownContent';

interface VoteDetailSheetProps {
  vote: VoteRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userPrefs?: UserPrefKey[];
}

const PROPOSAL_TYPE_LABELS: Record<string, { label: string; icon: typeof Landmark }> = {
  TreasuryWithdrawals: { label: 'Treasury', icon: Landmark },
  ParameterChange: { label: 'Parameter Change', icon: Shield },
  HardForkInitiation: { label: 'Hard Fork', icon: Zap },
  InfoAction: { label: 'Info Action', icon: Eye },
  NoConfidence: { label: 'No Confidence', icon: Scale },
  NewCommittee: { label: 'Constitutional Committee', icon: Scale },
  NewConstitutionalCommittee: { label: 'Constitutional Committee', icon: Scale },
  NewConstitution: { label: 'Constitution', icon: Scale },
  UpdateConstitution: { label: 'Constitution', icon: Scale },
};

const TREASURY_TIER_LABELS: Record<string, string> = {
  routine: '< 1M ADA',
  significant: '1M – 20M ADA',
  major: '> 20M ADA',
};

function AlignmentBadge({ alignment }: { alignment: VoteAlignment }) {
  if (alignment.status === 'neutral') return null;

  return (
    <Badge
      variant="outline"
      className={
        alignment.status === 'aligned'
          ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
          : 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30'
      }
    >
      {alignment.status === 'aligned' ? 'Aligned' : 'Unaligned'}
    </Badge>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-muted transition-colors">
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

export function VoteDetailSheet({
  vote,
  open,
  onOpenChange,
  userPrefs = [],
}: VoteDetailSheetProps) {
  if (!vote) return null;

  const alignment = evaluateVoteAlignment(
    vote.vote,
    vote.hasRationale,
    vote.proposalType,
    vote.treasuryTier,
    vote.relevantPrefs,
    userPrefs,
  );

  const typeInfo = vote.proposalType ? PROPOSAL_TYPE_LABELS[vote.proposalType] : null;
  const TypeIcon = typeInfo?.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={
                vote.vote === 'Yes' ? 'default' : vote.vote === 'No' ? 'destructive' : 'secondary'
              }
              className="text-sm"
            >
              {vote.vote}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {vote.date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <AlignmentBadge alignment={alignment} />
          </div>
          <SheetTitle className="text-lg leading-snug pt-1">{vote.title}</SheetTitle>
          <SheetDescription className="sr-only">Vote details for {vote.title}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          {/* Proposal Metadata Badges + View Full Proposal link */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {typeInfo && (
                <Badge variant="outline" className="gap-1">
                  {TypeIcon && <TypeIcon className="h-3 w-3" />}
                  {typeInfo.label}
                </Badge>
              )}
              {vote.treasuryTier && (
                <Badge variant="outline" className="text-xs">
                  {TREASURY_TIER_LABELS[vote.treasuryTier] || vote.treasuryTier}
                </Badge>
              )}
              {vote.withdrawalAmount && (
                <Badge variant="outline" className="text-xs">
                  {vote.withdrawalAmount.toLocaleString()} ADA
                </Badge>
              )}
            </div>
            <Link
              href={`/proposals/${vote.proposalTxHash}/${vote.proposalIndex}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
            >
              View Full Proposal <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Alignment Reasons */}
          {alignment.reasons.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Alignment Analysis
              </p>
              <ul className="space-y-1">
                {alignment.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                    <span
                      className={
                        alignment.status === 'aligned' ? 'text-green-500' : 'text-orange-500'
                      }
                    >
                      •
                    </span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Summary */}
          {vote.aiSummary && (
            <div className="bg-primary/5 border-l-2 border-primary/40 rounded-r-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">AI Summary</span>
              </div>
              <MarkdownContent content={vote.aiSummary} className="text-sm leading-relaxed" />
              <p className="text-[10px] text-muted-foreground mt-2">
                Generated by AI — may not capture all details
              </p>
            </div>
          )}

          {/* Full Proposal Description */}
          {vote.abstract && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {vote.aiSummary ? 'Full Description' : 'Proposal Description'}
              </p>
              <MarkdownContent
                content={vote.abstract}
                className="text-sm text-foreground/90 leading-relaxed"
              />
            </div>
          )}

          {/* Full Rationale */}
          {vote.rationaleText && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Voting Rationale
              </p>
              <div className="bg-muted/20 rounded-lg p-4 border border-border/20">
                <MarkdownContent
                  content={vote.rationaleText}
                  className="text-sm text-foreground/90 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Rationale pending state */}
          {vote.hasRationale && !vote.rationaleText && vote.rationaleUrl && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Voting Rationale
              </p>
              <div className="bg-muted/20 rounded-lg p-3 border border-border/20">
                <p className="text-xs text-muted-foreground">
                  This DRep submitted a rationale, but it hasn&apos;t been indexed yet. Check back
                  soon.
                </p>
              </div>
            </div>
          )}

          {/* No rationale for this vote */}
          {!vote.hasRationale && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Voting Rationale
              </p>
              <p className="text-xs text-muted-foreground">
                No on-chain rationale was submitted for this vote.
              </p>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              On-Chain Details
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vote Tx</span>
                <span className="font-mono flex items-center gap-1">
                  {vote.voteTxHash.slice(0, 12)}...{vote.voteTxHash.slice(-8)}
                  <CopyButton text={vote.voteTxHash} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Proposal Tx</span>
                <span className="font-mono flex items-center gap-1">
                  {vote.proposalTxHash.slice(0, 12)}...{vote.proposalTxHash.slice(-8)}
                  <CopyButton text={vote.proposalTxHash} />
                </span>
              </div>
            </div>
            <a
              href={`https://gov.tools/governance_actions/${vote.proposalTxHash}#${vote.proposalIndex}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary hover:underline mt-2"
            >
              View on GovTool <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
