'use client';

import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface NclImpactProps {
  /** Current utilization % (enacted / NCL) */
  currentUtilizationPct: number;
  /** This proposal's withdrawal amount in ADA */
  proposalAmountAda: number;
  /** Total NCL budget in ADA */
  nclAda: number;
  /** Remaining budget before this proposal (NCL - enacted) */
  remainingAda: number;
  /** Budget period start epoch */
  startEpoch?: number;
  /** Budget period end epoch */
  endEpoch?: number;
  /** Whether the proposal is already enacted */
  isEnacted?: boolean;
  /** 'compact' for cards/lists, 'detailed' for hero sections */
  variant?: 'compact' | 'detailed';
}

const STATUS_COLORS = {
  healthy: {
    enacted: 'bg-emerald-500',
    projected: 'bg-emerald-500/40',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/10',
  },
  elevated: {
    enacted: 'bg-amber-500',
    projected: 'bg-amber-500/40',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/10',
  },
  critical: {
    enacted: 'bg-red-500',
    projected: 'bg-red-500/40',
    text: 'text-red-400',
    border: 'border-red-500/20',
    bg: 'bg-red-500/10',
  },
};

function getStatus(pct: number): 'healthy' | 'elevated' | 'critical' {
  if (pct >= 80) return 'critical';
  if (pct >= 50) return 'elevated';
  return 'healthy';
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(0)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

export function NclImpactIndicator({
  currentUtilizationPct,
  proposalAmountAda,
  nclAda,
  remainingAda,
  startEpoch,
  endEpoch,
  isEnacted,
  variant = 'compact',
}: NclImpactProps) {
  const proposalPct = nclAda > 0 ? (proposalAmountAda / nclAda) * 100 : 0;
  const projectedPct =
    nclAda > 0 ? ((nclAda - remainingAda + proposalAmountAda) / nclAda) * 100 : 0;
  const projectedStatus = getStatus(projectedPct);
  const currentStatus = getStatus(currentUtilizationPct);
  const colors = STATUS_COLORS[projectedStatus];
  const wouldExceed = projectedPct > 100;

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded inline-flex items-center gap-1',
                colors.bg,
                colors.text,
                colors.border,
                'border',
              )}
            >
              {Math.round(proposalPct)}% of budget
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs">
              {isEnacted ? 'Used' : 'Would use'} ₳{formatAda(proposalAmountAda)} of the ₳
              {formatAda(nclAda)} budget limit
              {startEpoch && endEpoch ? ` (Epochs ${startEpoch}–${endEpoch})` : ''}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Budget: {Math.round(currentUtilizationPct)}% → {Math.round(projectedPct)}%
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed variant — mini bar + context text
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">Budget Impact</span>
        <span className={cn('font-semibold tabular-nums', colors.text)}>
          {Math.round(currentUtilizationPct)}% → {Math.round(Math.min(projectedPct, 100))}%
          {wouldExceed && ' ⚠'}
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="h-2 rounded-full bg-muted/30 overflow-hidden relative">
        {/* Current enacted */}
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-l-full',
            STATUS_COLORS[currentStatus].enacted,
          )}
          style={{ width: `${Math.min(currentUtilizationPct, 100)}%` }}
        />
        {/* This proposal's impact */}
        <div
          className={cn(
            'absolute inset-y-0',
            colors.projected,
            wouldExceed ? 'rounded-r-full' : '',
          )}
          style={{
            left: `${Math.min(currentUtilizationPct, 100)}%`,
            width: `${Math.min(proposalPct, 100 - Math.min(currentUtilizationPct, 100))}%`,
          }}
        />
      </div>

      {/* Context text */}
      <p className="text-xs text-muted-foreground">
        {wouldExceed ? (
          <span className="text-red-400 font-medium">
            This would exceed the constitutional budget limit by ₳
            {formatAda(proposalAmountAda - remainingAda)}
          </span>
        ) : isEnacted ? (
          <>
            This used {Math.round(proposalPct)}% of the budget period limit (₳
            {formatAda(nclAda)}
            {startEpoch && endEpoch ? ` for Epochs ${startEpoch}–${endEpoch}` : ''})
          </>
        ) : (
          <>
            If enacted, this uses {Math.round(proposalPct)}% of the remaining budget period limit (₳
            {formatAda(nclAda)}
            {startEpoch && endEpoch ? ` for Epochs ${startEpoch}–${endEpoch}` : ''})
          </>
        )}
      </p>
    </div>
  );
}
