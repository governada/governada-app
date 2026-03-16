'use client';

import { useState, useEffect } from 'react';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import { SealedBanner } from './SealedBanner';
import { IntelligenceBlocks } from './IntelligenceBlocks';
import { SourceMaterial } from './SourceMaterial';
import { FeatureGate } from '@/components/FeatureGate';

interface ReviewBriefProps {
  item: ReviewQueueItem;
}

function checkSealed(sealedUntil: string | null): boolean {
  if (sealedUntil == null) return false;
  return new Date(sealedUntil).getTime() > Date.now();
}

export function ReviewBrief({ item }: ReviewBriefProps) {
  const [isSealed, setIsSealed] = useState(false);

  useEffect(() => {
    setIsSealed(checkSealed(item.sealedUntil));
  }, [item.sealedUntil]);

  return (
    <div className="space-y-4">
      {/* Sealed Banner -- replaces tallies when active */}
      {isSealed && <SealedBanner sealedUntil={item.sealedUntil!} />}

      {/* AI Summary -- always shown */}
      {item.aiSummary && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">AI Summary</h3>
          <p className="text-sm leading-relaxed">{item.aiSummary}</p>
        </div>
      )}

      {/* Inter-Body Vote Tallies -- hidden when sealed */}
      {!isSealed && item.interBodyVotes && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Inter-Body Vote Tally</h3>
          <div className="space-y-2">
            <VoteTallyRow label="DRep" tally={item.interBodyVotes.drep} />
            <VoteTallyRow label="SPO" tally={item.interBodyVotes.spo} />
            <VoteTallyRow label="CC" tally={item.interBodyVotes.cc} />
          </div>
        </div>
      )}

      {/* Citizen Sentiment -- hidden when sealed */}
      {!isSealed && item.citizenSentiment != null && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Citizen Sentiment</h3>
          <SentimentBar sentiment={item.citizenSentiment} />
        </div>
      )}

      {/* Intelligence Blocks (AI-generated analysis) */}
      <FeatureGate flag="review_intelligence">
        <IntelligenceBlocks
          txHash={item.txHash}
          index={item.proposalIndex}
          title={item.title}
          abstract={item.abstract}
          proposalType={item.proposalType}
        />
      </FeatureGate>

      {/* Source Material -- always shown */}
      <SourceMaterial item={item} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// VoteTallyRow -- inline tally for a single governance body
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
// SentimentBar -- visual bar for citizen sentiment
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
