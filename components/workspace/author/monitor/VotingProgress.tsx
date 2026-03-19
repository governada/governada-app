'use client';

/**
 * VotingProgress — per-body progress bars with threshold markers.
 *
 * Shows DRep, SPO, and CC voting progress as horizontal bars with a
 * threshold line indicating the required percentage for ratification.
 */

import { cn } from '@/lib/utils';
import type { VotingBodyTally, CCTally } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VotingProgressProps {
  voting: {
    drep: VotingBodyTally;
    spo?: VotingBodyTally;
    cc?: CCTally;
  };
  /** Compact mode for portfolio cards — single bar, no labels */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute yes percentage from vote power (DRep/SPO) */
function yesPercentFromPower(body: VotingBodyTally): number {
  const total = body.yesVotePower + body.noVotePower + body.abstainVotePower;
  if (total === 0) return 0;
  // Threshold is measured against yes / (yes + no) — abstain excluded from denominator
  const effective = body.yesVotePower + body.noVotePower;
  if (effective === 0) return 0;
  return body.yesVotePower / effective;
}

/** Compute yes percentage from CC vote counts */
function yesPercentFromCounts(cc: CCTally): number {
  const total = cc.yesCount + cc.noCount + cc.abstainCount;
  if (total === 0) return 0;
  const effective = cc.yesCount + cc.noCount;
  if (effective === 0) return 0;
  return cc.yesCount / effective;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(0)}%`;
}

// ---------------------------------------------------------------------------
// Single bar component
// ---------------------------------------------------------------------------

function ProgressBar({
  label,
  yesPercent,
  threshold,
  compact,
}: {
  label: string;
  yesPercent: number;
  threshold: number;
  compact?: boolean;
}) {
  const barPercent = Math.min(yesPercent * 100, 100);
  const thresholdPercent = threshold * 100;
  const meetingThreshold = yesPercent >= threshold;

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <span className="text-xs text-muted-foreground w-10 shrink-0">{label}</span>
        <div className="relative flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              meetingThreshold ? 'bg-[var(--compass-teal)]' : 'bg-[var(--compass-teal)]/70',
            )}
            style={{ width: `${barPercent}%` }}
          />
          {/* Threshold marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground/40"
            style={{ left: `${thresholdPercent}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground w-9 text-right shrink-0">
          {formatPercent(yesPercent)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {formatPercent(yesPercent)} / {formatPercent(threshold)} threshold
        </span>
      </div>
      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            meetingThreshold ? 'bg-[var(--compass-teal)]' : 'bg-[var(--compass-teal)]/70',
          )}
          style={{ width: `${barPercent}%` }}
        />
        {/* Threshold line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-foreground/50"
          style={{ left: `${thresholdPercent}%` }}
          title={`Threshold: ${formatPercent(threshold)}`}
        />
      </div>
      {meetingThreshold && <p className="text-xs text-[var(--compass-teal)]">Threshold met</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VotingProgress({ voting, compact }: VotingProgressProps) {
  const drepPercent = yesPercentFromPower(voting.drep);

  if (compact) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <ProgressBar
          label="DRep"
          yesPercent={drepPercent}
          threshold={voting.drep.threshold}
          compact
        />
        {voting.spo && (
          <ProgressBar
            label="SPO"
            yesPercent={yesPercentFromPower(voting.spo)}
            threshold={voting.spo.threshold}
            compact
          />
        )}
        {voting.cc && (
          <ProgressBar
            label="CC"
            yesPercent={yesPercentFromCounts(voting.cc)}
            threshold={voting.cc.threshold}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Voting Progress
      </h3>

      <ProgressBar label="DRep" yesPercent={drepPercent} threshold={voting.drep.threshold} />

      {voting.spo && (
        <ProgressBar
          label="SPO"
          yesPercent={yesPercentFromPower(voting.spo)}
          threshold={voting.spo.threshold}
        />
      )}

      {voting.cc && (
        <ProgressBar
          label="Constitutional Committee"
          yesPercent={yesPercentFromCounts(voting.cc)}
          threshold={voting.cc.threshold}
        />
      )}
    </div>
  );
}
