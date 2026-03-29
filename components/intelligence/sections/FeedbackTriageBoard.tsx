'use client';

/**
 * FeedbackTriageBoard — card-based triage view for response_revision stage.
 *
 * Groups feedback themes by addressedStatus (open | addressed | deferred | dismissed)
 * and lets the proposer mark themes as addressed/deferred/dismissed.
 * Uses useFeedbackThemes + useAddressTheme from hooks/useFeedbackThemes.ts.
 */

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle2, Clock, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import { useFeedbackThemes, useAddressTheme } from '@/hooks/useFeedbackThemes';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeedbackTriageBoardProps {
  proposalTxHash: string | null;
  proposalIndex: number | null;
  /** Whether the current user can address themes (proposer/lead/editor) */
  canAddress: boolean;
}

// ---------------------------------------------------------------------------
// Status groups
// ---------------------------------------------------------------------------

type StatusGroup = 'open' | 'addressed' | 'deferred';

const STATUS_CONFIG: Record<
  StatusGroup,
  { label: string; Icon: typeof CheckCircle2; color: string; bgColor: string }
> = {
  open: {
    label: 'Unaddressed',
    Icon: AlertCircle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/5 border-amber-500/10',
  },
  addressed: {
    label: 'Addressed',
    Icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5 border-emerald-500/10',
  },
  deferred: {
    label: 'Deferred',
    Icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/10 border-border',
  },
};

// ---------------------------------------------------------------------------
// ThemeCard
// ---------------------------------------------------------------------------

function ThemeCard({
  theme,
  canAddress,
  txHash,
  index,
}: {
  theme: FeedbackTheme;
  canAddress: boolean;
  txHash: string;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const addressMutation = useAddressTheme(txHash, index);

  const handleAction = useCallback(
    (action: 'addressed' | 'deferred' | 'dismissed') => {
      addressMutation.mutate({ themeId: theme.id, action });
      posthog.capture('feedback_theme_addressed', {
        theme_id: theme.id,
        action,
        category: theme.category,
      });
    },
    [addressMutation, theme.id, theme.category],
  );

  const categoryColor =
    theme.category === 'concern'
      ? 'text-amber-400'
      : theme.category === 'suggestion'
        ? 'text-blue-400'
        : theme.category === 'question'
          ? 'text-purple-400'
          : 'text-emerald-400';

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-start gap-2 text-left cursor-pointer hover:bg-muted/20 transition-colors"
      >
        <span className={cn('text-[10px] font-medium shrink-0 mt-0.5', categoryColor)}>
          {theme.category}
        </span>
        <p className="text-xs text-foreground/80 leading-relaxed flex-1">{theme.summary}</p>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] text-muted-foreground/60 tabular-nums">
            {theme.endorsementCount}
          </span>
          <ChevronDown
            className={cn(
              'h-3 w-3 text-muted-foreground transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-2 border-t border-border/50">
          {/* Key voices */}
          {theme.keyVoices.length > 0 && (
            <div className="pt-2 space-y-1">
              {theme.keyVoices.slice(0, 2).map((voice, i) => (
                <p
                  key={i}
                  className="text-[11px] text-muted-foreground leading-relaxed pl-2 border-l-2 border-muted"
                >
                  {voice.text}
                </p>
              ))}
            </div>
          )}

          {/* Action buttons (proposer only) */}
          {canAddress && theme.addressedStatus === 'open' && (
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => handleAction('addressed')}
                disabled={addressMutation.isPending}
                className="rounded px-2 py-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                Mark Addressed
              </button>
              <button
                onClick={() => handleAction('deferred')}
                disabled={addressMutation.isPending}
                className="rounded px-2 py-1 text-[10px] font-medium bg-muted/30 text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Defer
              </button>
              <button
                onClick={() => handleAction('dismissed')}
                disabled={addressMutation.isPending}
                className="rounded px-2 py-1 text-[10px] font-medium bg-red-500/5 text-red-400/60 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <XCircle className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackTriageBoard({
  proposalTxHash,
  proposalIndex,
  canAddress,
}: FeedbackTriageBoardProps) {
  const { themes, isLoading } = useFeedbackThemes(proposalTxHash, proposalIndex);
  const [activeFilter, setActiveFilter] = useState<StatusGroup | 'all'>('all');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading feedback themes...</span>
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground/60 py-2">No feedback themes consolidated yet.</p>
    );
  }

  // Group themes by status
  const groups: Record<StatusGroup, FeedbackTheme[]> = {
    open: themes.filter((t) => t.addressedStatus === 'open'),
    addressed: themes.filter(
      (t) => t.addressedStatus === 'addressed' || t.addressedStatus === 'dismissed',
    ),
    deferred: themes.filter((t) => t.addressedStatus === 'deferred'),
  };

  const filtered = activeFilter === 'all' ? themes : (groups[activeFilter] ?? []);

  // Progress indicator
  const totalActionable = themes.length;
  const addressedCount = groups.addressed.length + groups.deferred.length;
  const progressPct = totalActionable > 0 ? (addressedCount / totalActionable) * 100 : 0;

  return (
    <div className="space-y-3 text-xs">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">
            {addressedCount}/{totalActionable} addressed
          </span>
          <span className="text-muted-foreground/60 tabular-nums">{Math.round(progressPct)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {(['all', 'open', 'addressed', 'deferred'] as const).map((status) => {
          const count = status === 'all' ? themes.length : (groups[status]?.length ?? 0);
          return (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer',
                activeFilter === status
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
              <span className="ml-1 tabular-nums opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Theme cards */}
      <div className="space-y-1.5">
        {filtered.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            canAddress={canAddress}
            txHash={proposalTxHash ?? ''}
            index={proposalIndex ?? 0}
          />
        ))}
      </div>
    </div>
  );
}
