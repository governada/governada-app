'use client';

import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConcernFlags } from '@/hooks/useEngagement';

const FLAG_LABELS: Record<string, string> = {
  too_expensive: 'Too Expensive',
  team_unproven: 'Team Unproven',
  duplicates_existing: 'Duplicates Existing',
  constitutional_concern: 'Constitutional Concern',
  insufficient_detail: 'Insufficient Detail',
  unrealistic_timeline: 'Unrealistic Timeline',
  conflict_of_interest: 'Conflict of Interest',
  scope_too_broad: 'Scope Too Broad',
};

const THRESHOLD = 10;

interface ConcernFlagBannerProps {
  txHash: string;
  proposalIndex: number;
  outcome: 'ratified' | 'expired' | 'dropped' | null;
}

/**
 * Shows a highlighted banner when concern flags exceed a threshold.
 * For resolved proposals, connects community concerns to the outcome.
 */
export function ConcernFlagBanner({ txHash, proposalIndex, outcome }: ConcernFlagBannerProps) {
  const { data } = useConcernFlags(txHash, proposalIndex);

  if (!data || data.total === 0) return null;

  // Find flags exceeding threshold
  const significantFlags = Object.entries(data.flags)
    .filter(([, count]) => count >= THRESHOLD)
    .sort(([, a], [, b]) => b - a);

  if (significantFlags.length === 0) return null;

  const topFlag = significantFlags[0];
  const topLabel = FLAG_LABELS[topFlag[0]] ?? topFlag[0];
  const topCount = topFlag[1];

  const isNegativeOutcome = outcome === 'dropped' || outcome === 'expired';

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 flex items-start gap-3',
        isNegativeOutcome ? 'bg-amber-500/5 border-amber-500/20' : 'bg-muted/50 border-border',
      )}
      role="alert"
      aria-label={`Community concern: ${topCount} citizens flagged this as ${topLabel}`}
    >
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="text-foreground">
          <span className="font-semibold tabular-nums">{topCount}</span> citizens flagged this as{' '}
          <span className="font-medium">&ldquo;{topLabel}&rdquo;</span>
          {significantFlags.length > 1 && (
            <span className="text-muted-foreground">
              {' '}
              and {significantFlags.length - 1} other concern
              {significantFlags.length - 1 !== 1 ? 's' : ''}
            </span>
          )}
        </p>
        {isNegativeOutcome && (
          <p className="text-muted-foreground mt-0.5">
            This proposal was {outcome === 'dropped' ? 'withdrawn' : 'not ratified'}.
          </p>
        )}
      </div>
    </div>
  );
}
