import { Badge } from '@/components/ui/badge';
import { ProposalStatusBadge, DeadlineBadge } from '@/components/ProposalStatusBadge';
import { getProposalTheme } from './proposal-theme';
import { cn } from '@/lib/utils';

interface CompactHeaderProps {
  title: string;
  proposalType: string;
  status: string;
  expirationEpoch: number | null;
  currentEpoch: number;
  withdrawalAmount: number | null;
  blockTime: number | null;
}

function formatTreasuryCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString();
}

function getStatusFromProps(status: string) {
  // Derive lifecycle epochs from the status string for the StatusBadge
  const s = status.toLowerCase();
  return {
    ratifiedEpoch: s === 'ratified' || s === 'enacted' ? 1 : null,
    enactedEpoch: s === 'enacted' ? 1 : null,
    droppedEpoch: s === 'dropped' ? 1 : null,
    expiredEpoch: s === 'expired' ? 1 : null,
  };
}

export function CompactHeader({
  title,
  proposalType,
  status,
  expirationEpoch,
  currentEpoch,
  withdrawalAmount,
  blockTime,
}: CompactHeaderProps) {
  const theme = getProposalTheme(proposalType);
  const TypeIcon = theme.icon;
  const statusEpochs = getStatusFromProps(status);

  const isOpen =
    !statusEpochs.ratifiedEpoch &&
    !statusEpochs.enactedEpoch &&
    !statusEpochs.droppedEpoch &&
    !statusEpochs.expiredEpoch;

  const remaining =
    isOpen && expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null;

  const date = blockTime
    ? new Date(blockTime * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 px-4 py-3 max-h-20">
      {/* Single row on desktop, stacked on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        {/* Type badge + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge
            variant="outline"
            className={cn('gap-1 font-semibold shrink-0 text-[10px]', theme.badgeClass)}
          >
            <TypeIcon className="h-3 w-3" />
            {theme.label}
          </Badge>
          <h1 className="text-sm font-semibold leading-tight truncate">{title}</h1>
        </div>

        {/* Status + deadline + treasury */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <ProposalStatusBadge
            ratifiedEpoch={statusEpochs.ratifiedEpoch}
            enactedEpoch={statusEpochs.enactedEpoch}
            droppedEpoch={statusEpochs.droppedEpoch}
            expiredEpoch={statusEpochs.expiredEpoch}
          />

          {isOpen && remaining != null && remaining > 0 && (
            <DeadlineBadge expirationEpoch={expirationEpoch} currentEpoch={currentEpoch} />
          )}

          {!isOpen && remaining === 0 && expirationEpoch != null && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          )}

          {withdrawalAmount != null && withdrawalAmount > 0 && (
            <Badge variant="outline" className="text-[10px] tabular-nums font-medium">
              &#x20B3; {formatTreasuryCompact(withdrawalAmount)}
            </Badge>
          )}

          {date && (
            <span className="text-[10px] text-muted-foreground hidden md:inline">{date}</span>
          )}
        </div>
      </div>
    </div>
  );
}
