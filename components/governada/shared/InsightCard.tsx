'use client';

import { cn } from '@/lib/utils';
import { Lightbulb } from 'lucide-react';

interface InsightCardProps {
  /** The insight text */
  insight: string;
  /** Category tag */
  category?: 'voting' | 'treasury' | 'behavior' | 'participation';
  /** Optional stat to highlight */
  stat?: string;
  className?: string;
}

const categoryLabels: Record<NonNullable<InsightCardProps['category']>, string> = {
  voting: 'Voting',
  treasury: 'Treasury',
  behavior: 'Behavior',
  participation: 'Participation',
};

export function InsightCard({ insight, category, stat, className }: InsightCardProps) {
  return (
    <div className={cn('rounded-lg border border-primary/10 bg-primary/5 px-4 py-3', className)}>
      {/* Header row */}
      <div className="mb-1.5 flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Did you know?
        </span>
        {category && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {categoryLabels[category]}
          </span>
        )}
      </div>

      {/* Insight body */}
      <p className="text-sm text-muted-foreground">
        {stat ? (
          <>
            <span className="font-semibold text-foreground">{stat}</span> {insight}
          </>
        ) : (
          insight
        )}
      </p>
    </div>
  );
}
