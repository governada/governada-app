'use client';

import { useState, useEffect } from 'react';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import { SealedBanner } from './SealedBanner';

interface InterBodyTally {
  yes: number;
  no: number;
  abstain: number;
}

interface ReviewBriefProps {
  item: ReviewQueueItem;
  aiSummary?: string | null;
  treasuryContext?: string | null;
  interBodyTally?: InterBodyTally | null;
  citizenSentiment?: number | null;
}

function checkSealed(sealedUntil: string | null): boolean {
  if (sealedUntil == null) return false;
  return new Date(sealedUntil).getTime() > Date.now();
}

export function ReviewBrief({
  item,
  aiSummary,
  treasuryContext,
  interBodyTally,
  citizenSentiment,
}: ReviewBriefProps) {
  const [isSealed, setIsSealed] = useState(false);

  useEffect(() => {
    setIsSealed(checkSealed(item.sealedUntil));
  }, [item.sealedUntil]);

  return (
    <div className="space-y-4">
      {/* Sealed Banner — replaces tallies when active */}
      {isSealed && <SealedBanner sealedUntil={item.sealedUntil!} />}

      {/* AI Summary — always shown */}
      {aiSummary && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">AI Summary</h3>
          <p className="text-sm leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Treasury Context — always shown */}
      {treasuryContext && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Treasury Context</h3>
          <p className="text-sm leading-relaxed">{treasuryContext}</p>
        </div>
      )}

      {/* Inter-Body Vote Tallies — hidden when sealed */}
      {!isSealed && interBodyTally && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Inter-Body Vote Tally</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-green-400">Yes: {interBodyTally.yes}</span>
            <span className="text-red-400">No: {interBodyTally.no}</span>
            <span className="text-muted-foreground">Abstain: {interBodyTally.abstain}</span>
          </div>
        </div>
      )}

      {/* Citizen Sentiment — hidden when sealed */}
      {!isSealed && citizenSentiment != null && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">Citizen Sentiment</h3>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.round(citizenSentiment * 100)}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {Math.round(citizenSentiment * 100)}% positive
            </span>
          </div>
        </div>
      )}

      {/* Source Material — always shown */}
      <div className="space-y-1.5">
        <h3 className="text-sm font-semibold text-muted-foreground">Proposal Details</h3>
        <div className="rounded-lg border border-border/60 bg-card p-3 text-sm">
          <p className="font-medium">{item.title || 'Untitled Proposal'}</p>
          {item.abstract && (
            <p className="mt-1.5 text-muted-foreground line-clamp-3">{item.abstract}</p>
          )}
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {item.proposalType} &middot; {item.txHash.slice(0, 16)}...#{item.index}
          </p>
        </div>
      </div>
    </div>
  );
}
