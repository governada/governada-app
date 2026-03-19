'use client';

/**
 * DepositStatus — displays the deposit tracking info for a submitted proposal.
 *
 * Shows deposit amount, lock/return status, and conditions for return.
 */

import { Lock, Unlock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DepositInfo, ProposalMonitorData } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DepositStatusProps {
  deposit: DepositInfo;
  expirationEpoch: number | null;
  status: ProposalMonitorData['status'];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  return ada.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const STATUS_CONFIG = {
  locked: {
    icon: Lock,
    label: 'Locked',
    color: 'text-[var(--wayfinder-amber)]',
    bgColor: 'bg-[var(--wayfinder-amber)]/10',
  },
  returned: {
    icon: Unlock,
    label: 'Returned',
    color: 'text-[var(--compass-teal)]',
    bgColor: 'bg-[var(--compass-teal)]/10',
  },
  at_risk: {
    icon: AlertTriangle,
    label: 'At Risk',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepositStatus({ deposit, expirationEpoch, status }: DepositStatusProps) {
  const config = STATUS_CONFIG[deposit.status];
  const Icon = config.icon;

  // Determine return condition text
  let returnCondition: string;
  if (deposit.status === 'returned') {
    if (status === 'ratified' || status === 'enacted') {
      returnCondition = 'Returned upon ratification';
    } else if (status === 'expired') {
      returnCondition = 'Returned upon expiration';
    } else {
      returnCondition = 'Deposit has been returned';
    }
  } else if (deposit.status === 'at_risk') {
    returnCondition =
      'Proposal was dropped (unconstitutional). Deposit may be at risk depending on protocol rules.';
  } else {
    // locked
    if (expirationEpoch != null) {
      returnCondition = `Returns on ratification or epoch ${expirationEpoch} (expiry)`;
    } else {
      returnCondition = 'Returns on ratification or expiry';
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Deposit
      </h3>

      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn('p-2 rounded-lg', config.bgColor)}>
          <Icon className={cn('h-4 w-4', config.color)} />
        </div>

        <div className="flex-1 space-y-1">
          {/* Status + amount */}
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
          </div>

          <p className="text-sm">
            <span className="font-mono tabular-nums">{formatAda(deposit.amount)}</span>
            <span className="text-muted-foreground ml-1">ADA</span>
          </p>

          {/* Return condition */}
          <p className="text-xs text-muted-foreground">{returnCondition}</p>
        </div>
      </div>
    </div>
  );
}
