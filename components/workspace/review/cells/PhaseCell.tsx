'use client';

import type { DecisionTablePhase } from '@/lib/workspace/types';

const PHASE_CONFIG: Record<
  DecisionTablePhase,
  { label: string; dotColor: string; textClass: string }
> = {
  feedback: { label: 'Feedback', dotColor: 'bg-blue-400', textClass: 'text-blue-400' },
  voting: { label: 'Voting', dotColor: 'bg-amber-400', textClass: 'text-amber-400' },
  completed: {
    label: 'Completed',
    dotColor: 'bg-muted-foreground/40',
    textClass: 'text-muted-foreground',
  },
};

export function PhaseCell({ phase }: { phase: DecisionTablePhase }) {
  const config = PHASE_CONFIG[phase];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${config.textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}
