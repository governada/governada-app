'use client';

/**
 * TimeBudget — compact widget showing estimated review time for the queue.
 *
 * Shows: "7 proposals ~ 28 min" with a clock icon.
 * Calculation: count proposals x estimated minutes per type.
 */

import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { ReviewQueueItem } from '@/lib/workspace/types';
import type { TimeBudgetEstimate } from '@/lib/workspace/types';

interface TimeBudgetProps {
  items: ReviewQueueItem[];
}

/** Estimated minutes to review each proposal type. */
const MINUTES_PER_TYPE: Record<string, number> = {
  TreasuryWithdrawals: 5,
  ParameterChange: 3,
  InfoAction: 2,
  NewConstitution: 8,
  HardForkInitiation: 5,
  NoConfidence: 3,
  NewCommittee: 4,
};

const DEFAULT_MINUTES = 3;

function estimateTimeBudget(items: ReviewQueueItem[]): TimeBudgetEstimate {
  let totalMinutes = 0;
  let highPriorityCount = 0;

  for (const item of items) {
    totalMinutes += MINUTES_PER_TYPE[item.proposalType] ?? DEFAULT_MINUTES;
    if (item.isUrgent) highPriorityCount++;
  }

  return {
    totalProposals: items.length,
    estimatedMinutes: totalMinutes,
    avgMinutesPerProposal: items.length > 0 ? Math.round(totalMinutes / items.length) : 0,
    highPriorityCount,
  };
}

export function TimeBudget({ items }: TimeBudgetProps) {
  const budget = useMemo(() => estimateTimeBudget(items), [items]);

  if (budget.totalProposals === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums">
        {budget.totalProposals} proposal{budget.totalProposals !== 1 ? 's' : ''}
      </span>
      <span className="text-muted-foreground/50">·</span>
      <span className="tabular-nums">~{budget.estimatedMinutes} min</span>
      {budget.highPriorityCount > 0 && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-rose-500 font-medium tabular-nums">
            {budget.highPriorityCount} urgent
          </span>
        </>
      )}
    </div>
  );
}
