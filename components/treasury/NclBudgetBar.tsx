'use client';

import { cn } from '@/lib/utils';
import { formatAda } from '@/lib/treasury';
import type { NclUtilization } from '@/lib/treasury';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NclBudgetBarProps {
  ncl: NclUtilization;
}

const STATUS_COLORS = {
  healthy: {
    enacted: 'bg-emerald-500',
    pending: 'bg-emerald-500/40',
    label: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: '#10b981',
  },
  elevated: {
    enacted: 'bg-amber-500',
    pending: 'bg-amber-500/40',
    label: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: '#f59e0b',
  },
  critical: {
    enacted: 'bg-red-500',
    pending: 'bg-red-500/40',
    label: 'text-red-400',
    border: 'border-red-500/30',
    glow: '#ef4444',
  },
} as const;

const STATUS_LABELS = {
  healthy: 'Healthy budget headroom',
  elevated: 'Budget moderately utilized',
  critical: 'Budget nearing limit — scrutiny recommended',
} as const;

export function NclBudgetBar({ ncl }: NclBudgetBarProps) {
  const colors = STATUS_COLORS[ncl.status];
  const enactedPct = Math.min(100, ncl.utilizationPct);
  const pendingPct = Math.min(100 - enactedPct, ncl.projectedUtilizationPct - ncl.utilizationPct);

  return (
    <div className={cn('rounded-xl border bg-card/70 backdrop-blur-md p-5', colors.border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-muted-foreground">
          NCL Budget: ₳{formatAda(ncl.period.nclAda)}{' '}
          <span className="text-xs">
            (Epochs {ncl.period.startEpoch}–{ncl.period.endEpoch})
          </span>
        </div>
        <span className={cn('text-xs font-medium', colors.label)}>{STATUS_LABELS[ncl.status]}</span>
      </div>

      {/* Segmented bar with glow */}
      <TooltipProvider>
        <div className="relative h-5 w-full">
          <div className="absolute inset-0 rounded-full bg-muted/30" />

          {/* Enacted segment */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-l-full transition-all',
                  colors.enacted,
                )}
                style={{
                  width: `${enactedPct}%`,
                  boxShadow: `0 0 8px ${colors.glow}40, 0 0 16px ${colors.glow}15`,
                }}
              >
                <div className="absolute inset-x-0 top-0 h-[40%] rounded-t-full bg-white/[0.12]" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Enacted: ₳{formatAda(ncl.enactedWithdrawalsAda)} ({Math.round(ncl.utilizationPct)}%)
              </p>
            </TooltipContent>
          </Tooltip>

          {/* Pending segment (hatched appearance via striped gradient) */}
          {pendingPct > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn('absolute inset-y-0 transition-all', colors.pending)}
                  style={{
                    left: `${enactedPct}%`,
                    width: `${pendingPct}%`,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 6px)',
                  }}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Pending: ₳{formatAda(ncl.pendingWithdrawalsAda)} ({Math.round(pendingPct)}%)
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Remaining (implicit via background) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute inset-y-0 rounded-r-full"
                style={{
                  left: `${enactedPct + pendingPct}%`,
                  width: `${Math.max(0, 100 - enactedPct - pendingPct)}%`,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>Remaining: ₳{formatAda(ncl.headroomAfterPendingAda)}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', colors.enacted)} />
          Enacted: ₳{formatAda(ncl.enactedWithdrawalsAda)}
        </span>
        {ncl.pendingWithdrawalsAda > 0 && (
          <span className="flex items-center gap-1.5">
            <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', colors.pending)} />
            Pending: ₳{formatAda(ncl.pendingWithdrawalsAda)}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted/30" />
          Remaining: ₳{formatAda(ncl.headroomAfterPendingAda)}
        </span>
      </div>

      {/* Context row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-muted-foreground">
        <span>
          Epoch {ncl.epochsElapsed} of {ncl.period.endEpoch - ncl.period.startEpoch} in this budget
          period ({Math.round(ncl.periodProgressPct)}%)
        </span>
        <span>
          {ncl.sustainabilityRatio >= 1
            ? `Annual income ≈ ₳${formatAda(ncl.period.nclAda * ncl.sustainabilityRatio)} vs NCL ₳${formatAda(ncl.period.nclAda)} — sustainable`
            : `⚠ NCL exceeds projected annual income (ratio: ${ncl.sustainabilityRatio}x)`}
        </span>
      </div>

      {/* Alerts */}
      {ncl.epochsRemaining < 10 && ncl.epochsRemaining > 0 && (
        <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
          Budget period ends in {ncl.epochsRemaining} epochs. A new NCL Info Action will need to be
          voted on.
        </div>
      )}
      {ncl.enactedWithdrawalsAda > ncl.period.nclAda && (
        <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
          ⚠ Enacted withdrawals (₳{formatAda(ncl.enactedWithdrawalsAda)}) exceed the NCL (₳
          {formatAda(ncl.period.nclAda)}). This may indicate a constitutional compliance issue.
        </div>
      )}
    </div>
  );
}
