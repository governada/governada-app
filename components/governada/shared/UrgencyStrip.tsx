'use client';

import { cn } from '@/lib/utils';
import { Clock, Flame } from 'lucide-react';

interface UrgencyStripProps {
  /** Number of active/open proposals */
  activeCount: number;
  /** Total ADA at stake across active proposals (formatted string, e.g., "₳12.5M") */
  adaAtStake?: string;
  /** Time remaining in current epoch */
  epochTimeRemaining?: string;
  className?: string;
}

export function UrgencyStrip({
  activeCount,
  adaAtStake,
  epochTimeRemaining,
  className,
}: UrgencyStripProps) {
  if (activeCount === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-primary/5 border border-primary/10 px-4 py-2.5 text-sm',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-medium">
        <Flame className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span>
          {activeCount} active proposal{activeCount !== 1 ? 's' : ''}
        </span>
      </span>

      {adaAtStake && <span className="text-muted-foreground">{adaAtStake} at stake</span>}

      {epochTimeRemaining && (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {epochTimeRemaining}
        </span>
      )}
    </div>
  );
}
