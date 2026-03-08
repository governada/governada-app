'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ConfidenceSource } from '@/lib/matching/confidence';

/* ─── Source colors ────────────────────────────────────── */

const SOURCE_COLORS: Record<string, string> = {
  quizAnswers: 'bg-blue-500',
  pollVotes: 'bg-green-500',
  proposalDiversity: 'bg-purple-500',
  engagement: 'bg-amber-500',
  delegation: 'bg-cyan-500',
};

const SOURCE_TEXT_COLORS: Record<string, string> = {
  quizAnswers: 'text-blue-500',
  pollVotes: 'text-green-500',
  proposalDiversity: 'text-purple-500',
  engagement: 'text-amber-500',
  delegation: 'text-cyan-500',
};

/* ─── Types ────────────────────────────────────────────── */

interface ConfidenceBarProps {
  /** Overall confidence percentage (0-100) */
  confidence: number;
  /** Source breakdown (progressive mode). Falls back to simple bar if absent. */
  sources?: ConfidenceSource[];
  /** Whether to show expandable source breakdown */
  expandable?: boolean;
  className?: string;
}

/**
 * Legacy props for backward compatibility.
 * When only votesUsed is provided, renders a simple vote-based bar.
 */
interface LegacyConfidenceBarProps {
  votesUsed: number;
  targetVotes?: number;
  className?: string;
}

/* ─── Component ────────────────────────────────────────── */

export function ConfidenceBar(props: ConfidenceBarProps | LegacyConfidenceBarProps) {
  // Detect legacy vs progressive mode
  if ('votesUsed' in props) {
    return <SimpleConfidenceBar {...props} />;
  }
  return <ProgressiveConfidenceBar {...props} />;
}

/* ─── Simple (legacy) bar ──────────────────────────────── */

function SimpleConfidenceBar({ votesUsed, targetVotes = 15, className }: LegacyConfidenceBarProps) {
  const pct = Math.min(100, Math.round((votesUsed / targetVotes) * 100));
  const isLow = pct < 50;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Match confidence</span>
        <span
          className={cn('font-medium tabular-nums', isLow ? 'text-amber-500' : 'text-green-500')}
        >
          {votesUsed}/{targetVotes} votes — {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isLow ? 'bg-amber-500' : 'bg-green-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─── Progressive (multi-source) bar ──────────────────── */

function ProgressiveConfidenceBar({
  confidence,
  sources,
  expandable = true,
  className,
}: ConfidenceBarProps) {
  const [expanded, setExpanded] = useState(false);
  const isLow = confidence < 40;
  const isMedium = confidence >= 40 && confidence < 70;

  const activeSources = sources?.filter((s) => s.active) ?? [];
  const hasBreakdown = activeSources.length > 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Match confidence</span>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'font-medium tabular-nums',
              isLow ? 'text-amber-500' : isMedium ? 'text-yellow-500' : 'text-green-500',
            )}
          >
            {confidence}%
          </span>
          {expandable && hasBreakdown && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label={expanded ? 'Hide breakdown' : 'Show breakdown'}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="h-2 rounded-full bg-muted overflow-hidden flex">
        {hasBreakdown ? (
          sources!.map((source) => {
            if (source.score <= 0) return null;
            return (
              <div
                key={source.key}
                className={cn(
                  'h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full',
                  SOURCE_COLORS[source.key] ?? 'bg-primary',
                )}
                style={{ width: `${source.score}%` }}
                title={`${source.label}: ${Math.round(source.score)}/${source.maxScore}`}
              />
            );
          })
        ) : (
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isLow ? 'bg-amber-500' : 'bg-green-500',
            )}
            style={{ width: `${confidence}%` }}
          />
        )}
      </div>

      {/* Expanded breakdown */}
      {expanded && sources && (
        <div className="space-y-1 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
          {sources.map((source) => (
            <div key={source.key} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn('w-2 h-2 rounded-full', SOURCE_COLORS[source.key] ?? 'bg-primary')}
                />
                <span className="text-muted-foreground">{source.label}</span>
              </div>
              <span
                className={cn(
                  'tabular-nums',
                  source.active
                    ? (SOURCE_TEXT_COLORS[source.key] ?? 'text-foreground')
                    : 'text-muted-foreground/50',
                )}
              >
                {source.current}/{source.target}
                {source.score >= source.maxScore && ' ✓'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
