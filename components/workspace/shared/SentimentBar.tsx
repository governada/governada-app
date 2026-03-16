'use client';

import { Users } from 'lucide-react';

export interface SentimentData {
  support: number;
  oppose: number;
  abstain: number;
  total: number;
}

/**
 * Citizen sentiment bar — horizontal stacked bar showing support/oppose ratio.
 * Extracted from ActionFeed.tsx for reuse across workspace components.
 */
export function SentimentBar({ sentiment }: { sentiment: SentimentData }) {
  if (sentiment.total === 0) return null;
  const supportPct = Math.round((sentiment.support / sentiment.total) * 100);
  const opposePct = Math.round((sentiment.oppose / sentiment.total) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Users className="h-3 w-3" />
        <span>
          Citizen sentiment ({sentiment.total} response{sentiment.total !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
        {supportPct > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${supportPct}%` }}
          />
        )}
        {opposePct > 0 && (
          <div className="h-full bg-rose-500 transition-all" style={{ width: `${opposePct}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums">
        <span className="text-emerald-600 dark:text-emerald-400">{supportPct}% support</span>
        <span className="text-rose-600 dark:text-rose-400">{opposePct}% oppose</span>
      </div>
    </div>
  );
}
