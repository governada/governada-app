'use client';

/**
 * ProposalHealthScore — compact circular badge showing proposal completeness (0-100%).
 *
 * Color-coded: red <50%, amber 50-80%, green >80%.
 * Hover tooltip lists which checks passed/failed.
 */

import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { computeProposalHealth } from '@/lib/workspace/proposalHealth';
import type { ReviewQueueItem } from '@/lib/workspace/types';

interface ProposalHealthScoreProps {
  item: ReviewQueueItem;
}

function CircularProgress({ score }: { score: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score < 50 ? 'stroke-rose-500' : score < 80 ? 'stroke-amber-500' : 'stroke-emerald-500';

  const textColor =
    score < 50 ? 'text-rose-500' : score < 80 ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
        {/* Background ring */}
        <circle cx="18" cy="18" r={radius} fill="none" className="stroke-muted" strokeWidth="3" />
        {/* Progress ring */}
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          className={cn(color, 'transition-all duration-500')}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('absolute text-[10px] font-bold tabular-nums', textColor)}>{score}%</span>
    </div>
  );
}

export function ProposalHealthScore({ item }: ProposalHealthScoreProps) {
  const health = useMemo(() => computeProposalHealth(item), [item]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2 cursor-default">
            <CircularProgress score={health.score} />
            <div className="text-xs">
              <p className="font-medium text-foreground">Health Score</p>
              <p className="text-muted-foreground">
                {health.score < 50 ? 'Incomplete' : health.score < 80 ? 'Partial' : 'Complete'}
              </p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64">
          <ul className="space-y-1">
            {health.checks.map((check) => (
              <li key={check.label} className="flex items-center gap-1.5 text-xs">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    check.passed ? 'bg-emerald-500' : 'bg-rose-500',
                  )}
                />
                <span>{check.label}</span>
                <span className="text-muted-foreground ml-auto">(x{check.weight})</span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
