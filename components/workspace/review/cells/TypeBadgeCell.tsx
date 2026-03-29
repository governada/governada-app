'use client';

import { Badge } from '@/components/ui/badge';
import { PROPOSAL_TYPE_LABELS, type ProposalType } from '@/lib/workspace/types';

const TYPE_COLORS: Record<string, string> = {
  TreasuryWithdrawals: 'border-amber-500/40 text-amber-400',
  ParameterChange: 'border-blue-500/40 text-blue-400',
  HardForkInitiation: 'border-red-500/40 text-red-400',
  NewConstitution: 'border-purple-500/40 text-purple-400',
  NewCommittee: 'border-indigo-500/40 text-indigo-400',
  NoConfidence: 'border-rose-500/40 text-rose-400',
  InfoAction: 'border-border text-muted-foreground',
};

export function TypeBadgeCell({ proposalType }: { proposalType: string }) {
  const label = PROPOSAL_TYPE_LABELS[proposalType as ProposalType] ?? proposalType;
  const colorClass = TYPE_COLORS[proposalType] ?? TYPE_COLORS.InfoAction;

  return (
    <Badge variant="outline" className={`text-xs font-normal ${colorClass}`}>
      {label}
    </Badge>
  );
}
