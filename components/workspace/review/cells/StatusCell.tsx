'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionTableStatus } from '@/lib/workspace/types';

const VOTE_COLORS: Record<string, string> = {
  Yes: 'border-emerald-500/40 text-emerald-400',
  No: 'border-red-500/40 text-red-400',
  Abstain: 'border-border text-muted-foreground',
};

export function StatusCell({
  status,
  voteChoice,
}: {
  status: DecisionTableStatus;
  voteChoice: string | null;
}) {
  switch (status) {
    case 'voted': {
      const colorClass = VOTE_COLORS[voteChoice ?? ''] ?? VOTE_COLORS.Abstain;
      return (
        <Badge variant="outline" className={`text-xs font-normal ${colorClass}`}>
          {voteChoice ?? 'Voted'}
        </Badge>
      );
    }
    case 'feedback_given':
      return (
        <Badge
          variant="outline"
          className="text-xs font-normal border-emerald-500/40 text-emerald-400"
        >
          Reviewed
        </Badge>
      );
    case 'snoozed':
      return <span className="text-xs text-muted-foreground/60">Snoozed</span>;
    case 'unreviewed':
    default:
      return <span className="text-xs text-muted-foreground/40">—</span>;
  }
}
