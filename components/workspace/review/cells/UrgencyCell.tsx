'use client';

import { Clock } from 'lucide-react';
import type { DecisionTableItem } from '@/lib/workspace/types';

export function UrgencyCell({ item }: { item: DecisionTableItem }) {
  // Completed items
  if (item.phase === 'completed') {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  // Feedback phase: show days in review
  if (item.phase === 'feedback') {
    const days = item.daysInReview ?? 0;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{days}d</span>
    );
  }

  // Voting phase: show epochs remaining
  const epochs = item.epochsRemaining;
  if (epochs == null) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  const colorClass =
    epochs <= 1 ? 'text-red-400' : epochs <= 3 ? 'text-amber-400' : 'text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Clock className="h-3 w-3" />
      {epochs}e
    </span>
  );
}
