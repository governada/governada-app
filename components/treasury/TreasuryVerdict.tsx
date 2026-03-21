'use client';

import { cn } from '@/lib/utils';
import { formatAda } from '@/lib/treasury';
import type { NclUtilization } from '@/lib/treasury';

interface TreasuryVerdictProps {
  balanceAda: number;
  trend: 'growing' | 'shrinking' | 'stable';
  ncl: NclUtilization | null;
  effectivenessRate: number | null;
  pendingCount: number;
  pendingTotalAda?: number;
  runwayMonths: number;
}

type VerdictStatus = 'healthy' | 'attention' | 'critical';

function deriveStatus(
  ncl: NclUtilization | null,
  effectivenessRate: number | null,
  trend: 'growing' | 'shrinking' | 'stable',
  runwayMonths: number,
): VerdictStatus {
  // Critical: NCL critical, or runway < 12 months
  if (ncl?.status === 'critical') return 'critical';
  if (runwayMonths > 0 && runwayMonths < 12) return 'critical';

  // Attention: NCL elevated, effectiveness low, or shrinking trend
  if (ncl?.status === 'elevated') return 'attention';
  if (effectivenessRate !== null && effectivenessRate < 50) return 'attention';
  if (trend === 'shrinking') return 'attention';

  return 'healthy';
}

const STATUS_CONFIG = {
  healthy: {
    label: 'Treasury is Healthy',
    color: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-500',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
  },
  attention: {
    label: 'Treasury Needs Attention',
    color: 'text-amber-400',
    ring: 'ring-amber-500/20',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-500',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
  },
  critical: {
    label: 'Treasury Under Pressure',
    color: 'text-red-400',
    ring: 'ring-red-500/20',
    bg: 'bg-red-500/10',
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]',
  },
} as const;

export function TreasuryVerdict({
  balanceAda,
  trend,
  ncl,
  effectivenessRate,
  pendingCount,
  pendingTotalAda,
  runwayMonths,
}: TreasuryVerdictProps) {
  const status = deriveStatus(ncl, effectivenessRate, trend, runwayMonths);
  const config = STATUS_CONFIG[status];

  const nclPct = ncl ? `${Math.round(ncl.utilizationPct)}%` : null;
  const effectivenessPct = effectivenessRate !== null ? `${effectivenessRate}%` : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 ring-1',
        config.ring,
        config.glow,
      )}
    >
      {/* Verdict headline */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', config.dot)} />
        <h2 className={cn('text-lg font-semibold', config.color)}>{config.label}</h2>
      </div>

      {/* Inline stats */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {nclPct && (
          <span className="text-muted-foreground">
            Budget <span className="font-semibold text-foreground">{nclPct}</span> used
          </span>
        )}
        {effectivenessPct && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{effectivenessPct}</span> delivered
          </span>
        )}
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{pendingCount}</span>{' '}
          {pendingCount === 1 ? 'proposal' : 'proposals'} pending
          {pendingTotalAda != null && pendingTotalAda > 0 && (
            <span className="ml-1">(₳{formatAda(pendingTotalAda)})</span>
          )}
        </span>
        <span className="text-muted-foreground">
          ₳<span className="font-semibold text-foreground">{formatAda(balanceAda)}</span> balance
          {trend !== 'stable' && (
            <span className="ml-1 text-xs">({trend === 'growing' ? '↑' : '↓'})</span>
          )}
        </span>
        {runwayMonths > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {runwayMonths < 12 ? `${runwayMonths}mo` : `${Math.round(runwayMonths / 12)}yr`}
            </span>{' '}
            runway
          </span>
        )}
      </div>
    </div>
  );
}
