import { Badge } from '@/components/ui/badge';
import { TriBodyVotePanel } from '@/components/TriBodyVotePanel';
import { DRepVoteCallout } from '@/components/DRepVoteCallout';
import {
  ProposalStatusBadge,
  PriorityBadge,
  DeadlineBadge,
  TreasuryTierBadge,
  TypeExplainerTooltip,
} from '@/components/ProposalStatusBadge';
import { ProposalVerdict } from './ProposalVerdict';
import { getProposalTheme } from './proposal-theme';
import { cn } from '@/lib/utils';
import type { TriBodyVotes } from '@/lib/data';
import { NclImpactIndicator } from '@/components/shared/NclImpactIndicator';
import { ProposalValueContext } from '@/components/shared/ProposalValueContext';
import type { NclUtilization } from '@/lib/treasury';

function formatTreasuryPct(amount: number, balance: number): string {
  const pct = (amount / balance) * 100;
  if (pct >= 1) return `${pct.toFixed(1)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(3)}%`;
}

interface ProposalHeroV2Props {
  txHash: string;
  proposalIndex: number;
  title: string;
  proposalType: string;
  status: string;
  withdrawalAmount: number | null;
  treasuryBalanceAda: number | null;
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
  nclUtilization?: NclUtilization | null;
}

export function ProposalHeroV2({
  txHash,
  proposalIndex,
  title,
  proposalType,
  status,
  withdrawalAmount,
  treasuryBalanceAda,
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
  nclUtilization,
}: ProposalHeroV2Props) {
  const theme = getProposalTheme(proposalType);
  const TypeIcon = theme.icon;

  const date = blockTime
    ? new Date(blockTime * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const isOpen = !ratifiedEpoch && !enactedEpoch && !droppedEpoch && !expiredEpoch;
  const remaining = expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null;
  const isUrgent = isOpen && remaining != null && remaining > 0 && remaining <= 2;
  const isTreasury = proposalType === 'TreasuryWithdrawals' && withdrawalAmount != null;

  return (
    <div className="space-y-4">
      {/* Hero card with type-specific gradient */}
      <div
        className="rounded-2xl border border-border/50 overflow-hidden"
        style={{ background: theme.heroBg }}
      >
        <div className="px-6 pt-6 pb-4 space-y-4">
          {/* Type indicator + status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('gap-1.5 font-semibold', theme.badgeClass)}>
              <TypeIcon className="h-3.5 w-3.5" />
              {theme.label}
            </Badge>
            <TypeExplainerTooltip proposalType={proposalType} />
            <ProposalStatusBadge
              ratifiedEpoch={ratifiedEpoch}
              enactedEpoch={enactedEpoch}
              droppedEpoch={droppedEpoch}
              expiredEpoch={expiredEpoch}
            />
            <PriorityBadge proposalType={proposalType} />
            {treasuryTier && <TreasuryTierBadge tier={treasuryTier} />}
            {proposedEpoch && (
              <Badge variant="secondary" className="text-[10px]">
                Epoch {proposedEpoch}
              </Badge>
            )}
            <DeadlineBadge expirationEpoch={expirationEpoch} currentEpoch={currentEpoch} />
          </div>

          {/* Urgency callout */}
          {isUrgent && remaining != null && (
            <div
              className={cn(
                'rounded-lg px-4 py-2.5 text-sm font-medium',
                remaining <= 1
                  ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/30'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30',
              )}
            >
              {remaining <= 1
                ? `Voting closes this epoch \u2014 roughly ${remaining * 5} days remaining`
                : `Voting closes in ${remaining} epochs (~${remaining * 5} days)`}
            </div>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
            {title}
          </h1>

          {/* Treasury withdrawal callout */}
          {isTreasury && (
            <div
              className="inline-flex items-baseline gap-2 rounded-lg px-4 py-2.5"
              style={{ backgroundColor: theme.accentMuted }}
            >
              <span className="text-2xl font-bold tabular-nums" style={{ color: theme.accent }}>
                {withdrawalAmount!.toLocaleString()} ADA
              </span>
              {treasuryBalanceAda != null && treasuryBalanceAda > 0 && (
                <span className="text-sm text-muted-foreground">
                  {formatTreasuryPct(withdrawalAmount!, treasuryBalanceAda)} of treasury
                </span>
              )}
            </div>
          )}

          {/* NCL Budget Impact — shows how this proposal affects the budget period limit */}
          {isTreasury && nclUtilization && (
            <NclImpactIndicator
              currentUtilizationPct={nclUtilization.utilizationPct}
              proposalAmountAda={withdrawalAmount!}
              nclAda={nclUtilization.period.nclAda}
              remainingAda={nclUtilization.remainingAda}
              startEpoch={nclUtilization.period.startEpoch}
              endEpoch={nclUtilization.period.endEpoch}
              isEnacted={enactedEpoch != null}
              variant="detailed"
            />
          )}

          {/* Value Context — historical comparison + value type classification */}
          {isTreasury && <ProposalValueContext txHash={txHash} proposalIndex={proposalIndex} />}

          {/* Date */}
          {date && <p className="text-xs text-muted-foreground">Proposed {date}</p>}
        </div>

        {/* Verdict strip at bottom of hero */}
        <div className="px-6 pb-5">
          <ProposalVerdict status={status} triBody={triBody} accentColor={theme.accent} />
        </div>
      </div>

      {/* Tri-body vote bars */}
      {triBody && (
        <TriBodyVotePanel triBody={triBody} txHash={txHash} proposalIndex={proposalIndex} />
      )}

      {/* User's DRep vote */}
      <DRepVoteCallout txHash={txHash} proposalIndex={proposalIndex} />
    </div>
  );
}
