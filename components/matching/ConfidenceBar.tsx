'use client';

import { cn } from '@/lib/utils';

interface ConfidenceBarProps {
  votesUsed: number;
  targetVotes?: number;
  className?: string;
}

export function ConfidenceBar({ votesUsed, targetVotes = 15, className }: ConfidenceBarProps) {
  const pct = Math.min(100, Math.round((votesUsed / targetVotes) * 100));
  const isLow = pct < 50;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Match confidence</span>
        <span className={cn('font-medium tabular-nums', isLow ? 'text-amber-500' : 'text-green-500')}>
          {votesUsed}/{targetVotes} votes — {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isLow ? 'bg-amber-500' : 'bg-green-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
