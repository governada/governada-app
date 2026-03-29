'use client';

import { ArrowRight } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  'Fix constitutional issue': 'text-red-400',
  'Review constitutional warnings': 'text-amber-400',
  'Continue drafting': 'text-muted-foreground',
  'Run constitutional check': 'text-sky-400',
  'Submit for review': 'text-[var(--compass-teal)]',
  'Address feedback': 'text-amber-400',
  'Monitor voting': 'text-[var(--compass-teal)]',
  Archived: 'text-muted-foreground/60',
};

export function NextActionCell({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
      {action}
      {action !== 'Archived' && <ArrowRight className="h-3 w-3" />}
    </span>
  );
}
