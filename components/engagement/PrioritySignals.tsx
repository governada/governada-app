'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, CheckCircle2, Wallet, ArrowUp } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { usePriorityRankings, useUserPrioritySignal } from '@/hooks/useEngagement';
import { PRIORITY_AREAS, type PriorityArea } from '@/lib/api/schemas/engagement';
import { PRIORITY_LABELS } from '@/lib/engagement/labels';

interface PrioritySignalsProps {
  epoch: number;
}

export function PrioritySignals({ epoch }: PrioritySignalsProps) {
  const { connected, isAuthenticated, authenticate } = useWallet();
  const {
    data: rankings,
    isLoading: rankingsLoading,
    refetch: refetchRankings,
  } = usePriorityRankings(epoch);
  const { data: userSignal, refetch: refetchUser } = useUserPrioritySignal(epoch);

  const [selected, setSelected] = useState<PriorityArea[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animated, setAnimated] = useState(false);

  const hasSubmitted = !!userSignal || submitted;

  // Staggered bar fill animation — must be before any early returns
  const rankingData = rankings?.rankings ?? [];
  useEffect(() => {
    if (rankingData.length > 0) {
      const timer = setTimeout(() => setAnimated(true), 50);
      return () => clearTimeout(timer);
    }
  }, [rankingData.length]);

  const togglePriority = useCallback((area: PriorityArea) => {
    hapticLight();
    setSelected((prev) => {
      if (prev.includes(area)) return prev.filter((p) => p !== area);
      if (prev.length >= 3) return prev;
      return [...prev, area];
    });
  }, []);

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    hapticLight();
    setSelected((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const submit = async () => {
    if (selected.length === 0) return;

    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    const token = getStoredSession();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    // Optimistic: show confirmed state immediately
    setSubmitted(true);

    try {
      const res = await fetch('/api/engagement/priorities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rankedPriorities: selected,
          epoch,
        }),
      });

      if (!res.ok) {
        setSubmitted(false); // Rollback
        if (res.status === 429) {
          throw new Error(
            "You've been active! You've reached the limit for this epoch — resets next epoch.",
          );
        }
        throw new Error('Failed to submit priorities');
      }

      await Promise.all([refetchRankings(), refetchUser()]);

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_priority_signaled', {
            ranked_priorities: selected,
            epoch,
          });
        })
        .catch(() => {});
    } catch (err) {
      setSubmitted(false); // Rollback on error
      setError(err instanceof Error ? err.message : 'Failed to submit priorities');
    } finally {
      setSubmitting(false);
    }
  };

  if (rankingsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  const totalVoters = rankings?.totalVoters ?? 0;

  return (
    <div className="space-y-6">
      {/* Community Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Community Priority Rankings
            {totalVoters > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalVoters} citizen{totalVoters !== 1 ? 's' : ''} voted)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalVoters === 0 ? (
            <p className="text-sm text-muted-foreground">
              No priority signals yet this epoch. Be the first to share what governance should focus
              on.
            </p>
          ) : (
            <div className="space-y-2">
              {rankingData
                .filter((r) => r.score > 0)
                .slice(0, 10)
                .map((item, index) => {
                  const maxScore = rankingData[0]?.score || 1;
                  const pct = Math.round((item.score / maxScore) * 100);
                  const info = PRIORITY_LABELS[item.priority as PriorityArea];
                  return (
                    <div key={item.priority} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="w-6 h-6 p-0 justify-center text-xs">
                            {item.rank}
                          </Badge>
                          <span>{info?.icon}</span>
                          <span>{info?.label ?? item.priority}</span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.firstChoiceCount} first-choice
                        </span>
                      </div>
                      <div
                        className="h-2 rounded-full bg-muted overflow-hidden"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${info?.label ?? item.priority}: ${pct}%`}
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                          style={{
                            width: animated ? `${pct}%` : '0%',
                            transitionDelay: `${index * 80}ms`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voting Card */}
      {!hasSubmitted ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What should governance focus on?</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pick your top 3 priorities in order. Tap to select, then reorder with the arrows.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!connected ? (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const event = new CustomEvent('openWalletConnect');
                  window.dispatchEvent(event);
                }}
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet to Vote
              </Button>
            ) : (
              <>
                {/* Selected priorities with ranking */}
                {selected.length > 0 && (
                  <div
                    className="space-y-2"
                    role="list"
                    aria-label="Your selected priorities in order"
                  >
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Your ranking
                    </p>
                    {selected.map((area, i) => {
                      const info = PRIORITY_LABELS[area];
                      return (
                        <div
                          key={area}
                          className="flex items-center gap-2 p-2 rounded-lg border border-primary/30 bg-primary/5"
                          role="listitem"
                        >
                          <Badge className="w-6 h-6 p-0 justify-center text-xs" aria-hidden="true">
                            {i + 1}
                          </Badge>
                          <span aria-hidden="true">{info.icon}</span>
                          <span className="text-sm flex-1">{info.label}</span>
                          {i > 0 && (
                            <button
                              onClick={() => moveUp(i)}
                              className="p-1 rounded hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              aria-label={`Move ${info.label} up in ranking`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            onClick={() => togglePriority(area)}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                            aria-label={`Remove ${info.label} from your selection`}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available priorities */}
                <div
                  className="grid grid-cols-2 md:grid-cols-3 gap-2"
                  role="group"
                  aria-label="Select your top 3 governance priorities"
                >
                  {(PRIORITY_AREAS as readonly PriorityArea[])
                    .filter((area) => !selected.includes(area))
                    .map((area) => {
                      const info = PRIORITY_LABELS[area];
                      const disabled = selected.length >= 3;
                      return (
                        <button
                          key={area}
                          onClick={() => togglePriority(area)}
                          disabled={disabled}
                          aria-label={`Select ${info.label} as a priority`}
                          className={`flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-all
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                            ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5 cursor-pointer motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]'}
                            border-border/50`}
                        >
                          <span className="text-lg" aria-hidden="true">
                            {info.icon}
                          </span>
                          <span>{info.label}</span>
                        </button>
                      );
                    })}
                </div>

                {selected.length > 0 && (
                  <div className="space-y-2">
                    <Button onClick={submit} disabled={submitting} className="w-full gap-1.5">
                      {submitting ? 'Submitting...' : `Submit Your Top ${selected.length}`}
                    </Button>
                    <div aria-live="polite" role="status">
                      {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-5 w-5 motion-safe:animate-scale-in" />
                <span className="font-medium">
                  Your priorities have been recorded for Epoch {epoch}. Thanks for making your voice
                  heard!
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground shrink-0"
                onClick={() => {
                  if (userSignal?.rankedPriorities) {
                    setSelected(userSignal.rankedPriorities as PriorityArea[]);
                  }
                  setSubmitted(false);
                }}
              >
                Update
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
