'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import { useGovernanceCalendar } from '@/hooks/useGovernanceCalendar';

function formatCountdown(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * GovernanceCalendar — compact widget for the ReviewQueue header area.
 *
 * Collapsed: "Epoch 537 . 2d 14h" inline.
 * Expanded: epoch progress bar, upcoming deadlines with countdowns,
 *           and active governance action counts.
 */
export function GovernanceCalendar() {
  const { data, isLoading } = useGovernanceCalendar();
  const [expanded, setExpanded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Sync countdown with data
  useEffect(() => {
    if (data?.secondsRemaining != null) {
      setCountdown(data.secondsRemaining);
    }
  }, [data?.secondsRemaining]);

  // Live countdown ticker
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleToggle = useCallback(() => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      posthog.capture('governance_calendar_viewed', {
        current_epoch: data?.currentEpoch,
        upcoming_count: data?.upcoming?.length ?? 0,
      });
    }
  }, [expanded, data]);

  if (isLoading || !data) return null;

  const urgentCount = data.upcoming.filter(
    (p) => p.epochsLeft !== null && p.epochsLeft <= 1,
  ).length;
  const expiringCount = data.upcoming.filter(
    (p) => p.epochsLeft !== null && p.epochsLeft <= 2,
  ).length;

  return (
    <Card className="border-border/50">
      {/* Compact header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-medium text-foreground">Epoch {data.currentEpoch}</span>
          <span className="text-muted-foreground">
            {countdown !== null ? formatCountdown(countdown) : '...'} left
          </span>
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
              {urgentCount} urgent
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50">
          {/* Epoch progress bar */}
          <div className="pt-2 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Epoch progress</span>
              <span className="tabular-nums">{data.epochProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${data.epochProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Next epoch in {countdown !== null ? formatCountdown(countdown) : '...'}
            </p>
          </div>

          {/* Upcoming deadlines */}
          {data.upcoming.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Expiring Soon ({expiringCount} in next 2 epochs)
              </p>
              <div className="space-y-0.5">
                {data.upcoming.slice(0, 5).map((p) => (
                  <div
                    key={`${p.txHash}-${p.index}`}
                    className="flex items-center gap-1.5 text-[11px] py-1 px-1 rounded hover:bg-muted/30 transition-colors"
                  >
                    {p.epochsLeft !== null && p.epochsLeft <= 1 && (
                      <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                    )}
                    <span className="truncate flex-1 text-foreground/80">{p.title}</span>
                    {p.daysLeft !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] shrink-0 px-1.5',
                          p.epochsLeft !== null && p.epochsLeft <= 1
                            ? 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-800'
                            : p.epochsLeft !== null && p.epochsLeft <= 2
                              ? 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                              : 'text-muted-foreground border-border',
                        )}
                      >
                        ~{p.daysLeft}d
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.upcoming.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">
              No proposals expiring in the next 2 epochs
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
