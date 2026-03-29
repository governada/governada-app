'use client';

/**
 * BatchProgressBar — displays batch review session progress.
 *
 * Shows "7/15 reviewed — ~35 min remaining" with a progress bar.
 * Time estimate only appears after 2+ proposals reviewed.
 * Celebration animation when all proposals are reviewed.
 */

import { CheckCircle2, Clock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchProgressBarProps {
  reviewed: number;
  total: number;
  /** Average seconds per proposal — null until 2+ reviewed */
  avgSeconds: number | null;
  /** Estimated remaining seconds — null until 2+ reviewed */
  estimatedRemaining: number | null;
  isComplete: boolean;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `~${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `~${hours}h ${remainMins}m`;
}

export function BatchProgressBar({
  reviewed,
  total,
  avgSeconds,
  estimatedRemaining,
  isComplete,
}: BatchProgressBarProps) {
  if (total === 0) return null;

  const progress = total > 0 ? (reviewed / total) * 100 : 0;

  if (isComplete) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-400/10 border border-emerald-400/20 text-xs animate-in fade-in slide-in-from-bottom-1 duration-300">
        <Trophy className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-emerald-400 font-medium">All {total} proposals reviewed</span>
        {avgSeconds != null && (
          <span className="text-muted-foreground ml-auto">
            avg {formatTime(avgSeconds)}/proposal
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
      <CheckCircle2 className="h-3 w-3 shrink-0 text-muted-foreground/50" />
      <span className="tabular-nums">
        <span className="text-foreground font-medium">{reviewed}</span>
        <span className="text-muted-foreground/60">/{total}</span>
      </span>
      <span className="text-muted-foreground/60">reviewed</span>

      {/* Progress bar */}
      <div className="flex-1 h-1 rounded-full bg-muted/30 min-w-[40px]">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            progress > 66
              ? 'bg-emerald-400'
              : progress > 33
                ? 'bg-amber-400'
                : 'bg-muted-foreground/30',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time estimate (only after 2+ reviews) */}
      {estimatedRemaining != null && (
        <span className="flex items-center gap-1 text-muted-foreground/60 shrink-0">
          <Clock className="h-2.5 w-2.5" />
          {formatTime(estimatedRemaining)}
        </span>
      )}
    </div>
  );
}
