'use client';

import { Badge } from '@/components/ui/badge';
import type { AuthorTablePhase } from '@/lib/workspace/types';

const PHASE_CONFIG: Record<AuthorTablePhase, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'border-border text-muted-foreground' },
  in_review: { label: 'In Review', className: 'border-amber-500/40 text-amber-400' },
  on_chain: {
    label: 'On-Chain',
    className: 'border-[var(--compass-teal)]/40 text-[var(--compass-teal)]',
  },
  archived: { label: 'Archived', className: 'border-border text-muted-foreground/60' },
};

export function AuthorPhaseCell({ phase }: { phase: AuthorTablePhase }) {
  const config = PHASE_CONFIG[phase];
  return (
    <Badge variant="outline" className={`text-xs font-normal ${config.className}`}>
      {config.label}
    </Badge>
  );
}
