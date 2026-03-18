'use client';

/**
 * AmendmentGenealogyTimeline — Vertical timeline showing the history of amendment changes.
 *
 * Each node shows: action icon, action text + relative timestamp, actor identity,
 * source badge (Author/Reviewer/AI), and optional reason text.
 * Can be filtered to a specific changeId.
 */

import { useMemo } from 'react';
import { Plus, Check, X, Pencil, GitMerge, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenealogyEntry } from '@/lib/constitution/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GenealogyTimelineProps {
  entries: GenealogyEntry[];
  /** Filter to a specific change's events */
  changeId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<
  GenealogyEntry['action'],
  { Icon: typeof Plus; label: string; color: string }
> = {
  created: { Icon: Plus, label: 'Created', color: 'text-blue-400' },
  accepted: { Icon: Check, label: 'Accepted', color: 'text-emerald-400' },
  rejected: { Icon: X, label: 'Rejected', color: 'text-red-400' },
  modified: { Icon: Pencil, label: 'Modified', color: 'text-amber-400' },
  merged: { Icon: GitMerge, label: 'Merged', color: 'text-violet-400' },
};

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  author: { label: 'Author', className: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  reviewer: {
    label: 'Reviewer',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
  ai: { label: 'AI', className: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

function truncateAddress(addr: string): string {
  if (addr === 'AI' || addr === 'ai' || addr === 'system') return addr;
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AmendmentGenealogyTimeline({ entries, changeId }: GenealogyTimelineProps) {
  const filtered = useMemo(() => {
    const list = changeId ? entries.filter((e) => e.changeId === changeId) : entries;
    // Sort newest first
    return [...list].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [entries, changeId]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <History className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground/60">No history recorded yet</p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {filtered.map((entry, idx) => {
        const config = ACTION_CONFIG[entry.action];
        const sourceBadge = entry.sourceType ? SOURCE_BADGES[entry.sourceType] : null;
        const isLast = idx === filtered.length - 1;
        const { Icon } = config;

        return (
          <div
            key={`${entry.changeId}-${entry.action}-${entry.timestamp}-${idx}`}
            className="relative flex gap-3 pb-4"
          >
            {/* Vertical connector line */}
            {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border/50" />}

            {/* Icon node */}
            <div
              className={cn(
                'relative z-10 flex items-center justify-center h-6 w-6 rounded-full border border-border/50 bg-card shrink-0',
                config.color,
              )}
            >
              <Icon className="h-3 w-3" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground/60 font-mono truncate">
                  {truncateAddress(entry.actionBy)}
                </span>
                {sourceBadge && (
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium border',
                      sourceBadge.className,
                    )}
                  >
                    {sourceBadge.label}
                  </span>
                )}
              </div>

              {entry.actionReason && (
                <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">
                  {entry.actionReason}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
