import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TriBodyVotePanel } from '@/components/TriBodyVotePanel';
import { DRepVoteCallout } from '@/components/DRepVoteCallout';
import {
  ProposalStatusBadge,
  PriorityBadge,
  DeadlineBadge,
  TreasuryTierBadge,
  TypeExplainerTooltip,
} from '@/components/ProposalStatusBadge';
import { Landmark, Shield, Zap, Eye, Scale } from 'lucide-react';
import type { TriBodyVotes } from '@/lib/data';

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Landmark; color: string }> = {
  TreasuryWithdrawals: {
    label: 'Treasury Withdrawal',
    icon: Landmark,
    color: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  ParameterChange: {
    label: 'Parameter Change',
    icon: Shield,
    color: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  HardForkInitiation: {
    label: 'Hard Fork Initiation',
    icon: Zap,
    color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  },
  InfoAction: {
    label: 'Info Action',
    icon: Eye,
    color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
  NoConfidence: {
    label: 'No Confidence',
    icon: Scale,
    color: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  },
  NewCommittee: {
    label: 'Constitutional Committee',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  NewConstitutionalCommittee: {
    label: 'Constitutional Committee',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  NewConstitution: {
    label: 'Constitution',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  UpdateConstitution: {
    label: 'Constitution',
    icon: Scale,
    color: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
};

interface ProposalHeroV1Props {
  txHash: string;
  proposalIndex: number;
  title: string;
  proposalType: string;
  status: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  proposedEpoch: number | null;
  expirationEpoch: number | null;
  ratifiedEpoch: number | null;
  enactedEpoch: number | null;
  droppedEpoch: number | null;
  expiredEpoch: number | null;
  currentEpoch: number;
  triBody: TriBodyVotes | null;
  blockTime: number | null;
}

export function ProposalHeroV1({
  txHash,
  proposalIndex,
  title,
  proposalType,
  withdrawalAmount,
  treasuryTier,
  proposedEpoch,
  expirationEpoch,
  ratifiedEpoch,
  enactedEpoch,
  droppedEpoch,
  expiredEpoch,
  currentEpoch,
  triBody,
  blockTime,
}: ProposalHeroV1Props) {
  const config = TYPE_CONFIG[proposalType];
  const TypeIcon = config?.icon;

  const date = blockTime
    ? new Date(blockTime * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-4">
      {/* Badge row */}
      <div className="flex items-center gap-2 flex-wrap">
        <ProposalStatusBadge
          ratifiedEpoch={ratifiedEpoch}
          enactedEpoch={enactedEpoch}
          droppedEpoch={droppedEpoch}
          expiredEpoch={expiredEpoch}
        />
        <PriorityBadge proposalType={proposalType} />
        {config && (
          <Badge variant="outline" className={`gap-1 ${config.color}`}>
            {TypeIcon && <TypeIcon className="h-3.5 w-3.5" />}
            {config.label}
          </Badge>
        )}
        <TypeExplainerTooltip proposalType={proposalType} />
        {treasuryTier && <TreasuryTierBadge tier={treasuryTier} />}
        {proposedEpoch && <Badge variant="secondary">Epoch {proposedEpoch}</Badge>}
        <DeadlineBadge expirationEpoch={expirationEpoch} currentEpoch={currentEpoch} />
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>

      {/* Treasury withdrawal callout */}
      {proposalType === 'TreasuryWithdrawals' && withdrawalAmount && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 px-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {withdrawalAmount.toLocaleString()} ADA requested
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tri-body vote bars */}
      {triBody && (
        <TriBodyVotePanel triBody={triBody} txHash={txHash} proposalIndex={proposalIndex} />
      )}

      {/* User's DRep vote */}
      <DRepVoteCallout txHash={txHash} proposalIndex={proposalIndex} />

      {/* Date proposed */}
      {date && <p className="text-xs text-muted-foreground">Proposed {date}</p>}
    </div>
  );
}
