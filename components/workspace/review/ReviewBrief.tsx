'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Brain, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import { PROPOSAL_TYPE_LABELS, type ProposalType } from '@/lib/workspace/types';
import { ProposalContent } from './ProposalContent';
import { SealedBanner } from './SealedBanner';
import { IntelligenceBlocks } from './IntelligenceBlocks';
import { CompetingComparison } from './CompetingComparison';
import { SourceMaterial } from './SourceMaterial';
import { FeatureGate } from '@/components/FeatureGate';

interface ReviewBriefProps {
  item: ReviewQueueItem;
  /** All items in the review queue — used for competing proposal comparison */
  allItems?: ReviewQueueItem[];
}

function checkSealed(sealedUntil: string | null): boolean {
  if (sealedUntil == null) return false;
  return new Date(sealedUntil).getTime() > Date.now();
}

/**
 * ReviewBrief — the main content area for a proposal under review.
 *
 * Layout priority:
 * 1. Header (title, type badge, urgency, epochs remaining)
 * 2. ProposalContent (dominant — full proposal text with markdown)
 * 3. Intelligence & Analysis (collapsible accordion with all intelligence blocks)
 * 4. Source Material (compact: type, CardanoScan link, anchor URL)
 */
export function ReviewBrief({ item, allItems = [] }: ReviewBriefProps) {
  const [isSealed, setIsSealed] = useState(false);
  const [intelligenceExpanded, setIntelligenceExpanded] = useState(false);

  useEffect(() => {
    setIsSealed(checkSealed(item.sealedUntil));
  }, [item.sealedUntil]);

  const typeLabel = PROPOSAL_TYPE_LABELS[item.proposalType as ProposalType] || item.proposalType;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground leading-snug">
          {item.title || 'Untitled Proposal'}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {typeLabel}
          </Badge>
          {item.isUrgent && (
            <Badge
              variant="outline"
              className="text-xs text-rose-600 border-rose-500/30 bg-rose-500/10"
            >
              <AlertTriangle className="h-3 w-3 mr-1" />
              Urgent
            </Badge>
          )}
          {item.epochsRemaining != null && (
            <span
              className={cn(
                'text-xs',
                item.epochsRemaining <= 1 ? 'text-rose-500 font-medium' : 'text-muted-foreground',
              )}
            >
              {item.epochsRemaining === 0
                ? 'Expires this epoch'
                : `${item.epochsRemaining} epoch${item.epochsRemaining !== 1 ? 's' : ''} remaining`}
            </span>
          )}
          {item.withdrawalAmount != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {(item.withdrawalAmount / 1_000_000).toLocaleString()} ADA
            </span>
          )}
        </div>
      </div>

      {/* Sealed Banner */}
      {isSealed && <SealedBanner sealedUntil={item.sealedUntil!} />}

      {/* Proposal Content — front and center */}
      <ProposalContent
        abstract={item.abstract}
        motivation={item.motivation}
        rationale={item.rationale}
        references={item.references}
      />

      {/* Intelligence & Analysis — collapsible */}
      <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
        <button
          onClick={() => setIntelligenceExpanded(!intelligenceExpanded)}
          className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/20 transition-colors"
          aria-expanded={intelligenceExpanded}
          aria-label={
            intelligenceExpanded ? 'Collapse intelligence panel' : 'Expand intelligence panel'
          }
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-foreground">
              Intelligence &amp; Analysis
            </span>
          </div>
          {intelligenceExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {intelligenceExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/40 pt-3">
            {/* AI Summary */}
            {item.aiSummary && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-muted-foreground">AI Summary</h3>
                <p className="text-sm leading-relaxed">{item.aiSummary}</p>
              </div>
            )}

            {/* Constitutional Check + Similar Proposals + Perspective Diversity */}
            <FeatureGate flag="review_intelligence">
              <IntelligenceBlocks
                txHash={item.txHash}
                index={item.proposalIndex}
                title={item.title}
                abstract={item.abstract}
                proposalType={item.proposalType}
                isSealed={isSealed}
              />
            </FeatureGate>

            {/* Competing Proposal Comparison */}
            {allItems.length > 1 && <CompetingComparison currentItem={item} allItems={allItems} />}

            {/* Inter-Body Vote Tallies — hidden when sealed */}
            {!isSealed && item.interBodyVotes && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Inter-Body Vote Tally
                </h3>
                <div className="space-y-2">
                  <VoteTallyRow label="DRep" tally={item.interBodyVotes.drep} />
                  <VoteTallyRow label="SPO" tally={item.interBodyVotes.spo} />
                  <VoteTallyRow label="CC" tally={item.interBodyVotes.cc} />
                </div>
              </div>
            )}

            {/* Citizen Sentiment — hidden when sealed */}
            {!isSealed && item.citizenSentiment != null && (
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-muted-foreground">Citizen Sentiment</h3>
                <SentimentBar sentiment={item.citizenSentiment} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Source Material — compact, always visible */}
      <SourceMaterial item={item} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VoteTallyRow — inline tally for a single governance body
// ---------------------------------------------------------------------------

function VoteTallyRow({
  label,
  tally,
}: {
  label: string;
  tally: { yes: number; no: number; abstain: number };
}) {
  const total = tally.yes + tally.no + tally.abstain;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-10 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-3">
        <span className="text-emerald-600 dark:text-emerald-400">Yes: {tally.yes}</span>
        <span className="text-rose-600 dark:text-rose-400">No: {tally.no}</span>
        <span className="text-muted-foreground">Abstain: {tally.abstain}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SentimentBar — visual bar for citizen sentiment
// ---------------------------------------------------------------------------

function SentimentBar({
  sentiment,
}: {
  sentiment: { support: number; oppose: number; abstain: number; total: number };
}) {
  const supportPct =
    sentiment.total > 0 ? Math.round((sentiment.support / sentiment.total) * 100) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${supportPct}%` }} />
      </div>
      <span className="text-sm text-muted-foreground">{supportPct}% support</span>
    </div>
  );
}
