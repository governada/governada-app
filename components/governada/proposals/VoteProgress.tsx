'use client';

import { TrendingUp, AlertTriangle, CheckCircle2, XCircle, Minus, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDepthConfig } from '@/hooks/useDepthConfig';
import { cn } from '@/lib/utils';
import type { VoteProjection, ProjectedOutcome } from '@/lib/voteProjection';

interface VoteProgressProps {
  projection: VoteProjection;
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// Verdict styling
// ---------------------------------------------------------------------------

function getVerdictStyle(outcome: ProjectedOutcome) {
  switch (outcome) {
    case 'passing':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10 border-emerald-500/20',
        barColor: 'bg-emerald-500',
      };
    case 'likely_pass':
      return {
        icon: TrendingUp,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-400/10 border-emerald-400/20',
        barColor: 'bg-emerald-400',
      };
    case 'leaning_pass':
      return {
        icon: TrendingUp,
        color: 'text-emerald-300',
        bgColor: 'bg-emerald-300/10 border-emerald-300/20',
        barColor: 'bg-emerald-300',
      };
    case 'too_close':
      return {
        icon: AlertTriangle,
        color: 'text-amber-400',
        bgColor: 'bg-amber-400/10 border-amber-400/20',
        barColor: 'bg-amber-400',
      };
    case 'leaning_fail':
      return {
        icon: Minus,
        color: 'text-orange-400',
        bgColor: 'bg-orange-400/10 border-orange-400/20',
        barColor: 'bg-orange-400',
      };
    case 'unlikely_pass':
      return {
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-400/10 border-red-400/20',
        barColor: 'bg-red-400',
      };
    case 'no_threshold':
      return {
        icon: Info,
        color: 'text-blue-400',
        bgColor: 'bg-blue-400/10 border-blue-400/20',
        barColor: 'bg-blue-400',
      };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoteProgress({ projection, isOpen }: VoteProgressProps) {
  const { proposalSections } = useDepthConfig<'governance'>('governance');
  const depth = getDepthLevel(proposalSections);
  const style = getVerdictStyle(projection.projectedOutcome);
  const Icon = style.icon;

  // For closed proposals, show final result instead of projection
  if (!isOpen) {
    return (
      <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', style.bgColor)}>
        <Icon className={cn('h-4 w-4 shrink-0', style.color)} />
        <div className="min-w-0">
          <span className={cn('text-sm font-medium', style.color)}>
            {projection.isPassing ? 'Passed' : 'Did not pass'}
          </span>
          {depth >= 1 && (
            <span className="text-sm text-muted-foreground ml-2">{projection.verdictDetail}</span>
          )}
        </div>
      </div>
    );
  }

  // ─── hands_off: single verdict line ─────────────────────────────────
  if (depth === 0) {
    return (
      <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', style.bgColor)}>
        <Icon className={cn('h-4 w-4 shrink-0', style.color)} />
        <span className={cn('text-sm font-medium', style.color)}>{projection.verdictLabel}</span>
        {projection.thresholdPct != null && (
          <span className="text-xs text-muted-foreground">
            {Math.round(projection.currentYesPct)}% of {Math.round(projection.thresholdPct)}% needed
          </span>
        )}
      </div>
    );
  }

  // ─── informed+: progress bar with threshold ─────────────────────────
  return (
    <div className={cn('rounded-xl border overflow-hidden', style.bgColor)}>
      {/* Verdict header */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn('h-4 w-4 shrink-0', style.color)} />
          <span className={cn('text-sm font-medium', style.color)}>{projection.verdictLabel}</span>
          {projection.confidence === 'low' && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">
              Limited data
            </Badge>
          )}
        </div>
        {projection.epochsRemaining != null && projection.epochsRemaining > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {projection.epochsRemaining} epoch{projection.epochsRemaining !== 1 ? 's' : ''}{' '}
            remaining
          </span>
        )}
      </div>

      {/* Progress bar */}
      {projection.thresholdPct != null && (
        <div className="px-4 pb-3">
          <div className="relative h-2.5 rounded-full bg-muted/50 overflow-visible">
            {/* Yes power fill */}
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                style.barColor,
              )}
              style={{ width: `${Math.min(100, projection.currentYesPct)}%` }}
            />
            {/* Projected fill (ghost) */}
            {projection.projectedFinalYesPct != null &&
              projection.projectedFinalYesPct > projection.currentYesPct && (
                <div
                  className={cn('absolute inset-y-0 rounded-r-full opacity-25', style.barColor)}
                  style={{
                    left: `${Math.min(100, projection.currentYesPct)}%`,
                    width: `${Math.min(100 - projection.currentYesPct, projection.projectedFinalYesPct - projection.currentYesPct)}%`,
                  }}
                />
              )}
            {/* Threshold marker */}
            <div
              className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-foreground/60"
              style={{ left: `${Math.min(100, projection.thresholdPct)}%` }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap">
                {Math.round(projection.thresholdPct)}%
              </div>
            </div>
          </div>

          {/* Numbers below bar */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-foreground/70">
              {projection.currentYesPct.toFixed(1)}% voting Yes
            </span>
            {projection.projectedFinalYesPct != null &&
              Math.abs(projection.projectedFinalYesPct - projection.currentYesPct) > 1 && (
                <span className="text-xs text-muted-foreground">
                  Projected: {Math.round(projection.projectedFinalYesPct)}%
                </span>
              )}
          </div>
        </div>
      )}

      {/* engaged+: detailed context */}
      {depth >= 2 && (
        <div className="px-4 pb-3 space-y-1.5 border-t border-border/20 pt-2.5">
          <p className="text-xs text-foreground/70">{projection.verdictDetail}</p>
          {projection.historicalEvidence && (
            <p className="text-xs text-muted-foreground">{projection.historicalEvidence}</p>
          )}
          {projection.confidence !== 'high' && (
            <p className="text-[10px] text-muted-foreground italic">
              {projection.confidenceReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map the proposalSections config to a numeric depth level */
function getDepthLevel(sections: Record<string, boolean>): 0 | 1 | 2 | 3 {
  if (sections.sourceMaterial) return 3; // deep
  if (sections.outcomeSection) return 2; // engaged
  if (sections.actionZone) return 1; // informed
  return 0; // hands_off
}
