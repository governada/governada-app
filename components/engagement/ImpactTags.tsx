'use client';

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Star, Info, CheckCircle2, Wallet } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { useImpactTags } from '@/hooks/useEngagement';

const AWARENESS_OPTIONS = [
  { value: 'i_use_this', label: 'I use this', icon: '🙋' },
  { value: 'i_tried_it', label: 'I tried it', icon: '👀' },
  { value: 'didnt_know_about_it', label: "Didn't know about it", icon: '🤷' },
] as const;

const RATING_OPTIONS = [
  { value: 'essential', label: 'Essential', color: 'bg-green-500' },
  { value: 'useful', label: 'Useful', color: 'bg-blue-500' },
  { value: 'okay', label: 'Okay', color: 'bg-amber-500' },
  { value: 'disappointing', label: 'Disappointing', color: 'bg-red-500' },
] as const;

interface ImpactTagsProps {
  txHash: string;
  proposalIndex: number;
}

export function ImpactTags({ txHash, proposalIndex }: ImpactTagsProps) {
  const { connected, isAuthenticated, authenticate } = useWallet();
  const { data: results, isLoading, refetch } = useImpactTags(txHash, proposalIndex);

  const [selectedAwareness, setSelectedAwareness] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasUserTag = !!results?.userTag;

  const submit = async () => {
    if (!selectedAwareness || !selectedRating) return;

    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    const token = getStoredSession();
    if (!token) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/engagement/impact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposalTxHash: txHash,
          proposalIndex,
          awareness: selectedAwareness,
          rating: selectedRating,
        }),
      });

      if (!res.ok) throw new Error('Failed to submit feedback');

      await refetch();
      setSubmitted(true);

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_impact_tagged', {
            proposal_tx_hash: txHash,
            proposal_index: proposalIndex,
            awareness: selectedAwareness,
            rating: selectedRating,
          });
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const total = results?.total ?? 0;
  const awareness = results?.awareness ?? {};
  const ratings = results?.ratings ?? {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Citizen Impact Feedback
            {total > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({total} response{total !== 1 ? 's' : ''})
              </span>
            )}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[260px]">
                <p className="text-xs">
                  Share your experience with this funded project. Citizen feedback helps the
                  community evaluate treasury spending.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Aggregated results (always visible) */}
        {total > 0 && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Awareness
              </p>
              <div className="flex gap-3">
                {AWARENESS_OPTIONS.map((opt) => (
                  <div key={opt.value} className="text-center">
                    <span className="text-lg">{opt.icon}</span>
                    <p className="text-xs text-muted-foreground">{opt.label}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {awareness[opt.value] || 0}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Rating
              </p>
              {RATING_OPTIONS.map((opt) => {
                const count = ratings[opt.value] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={opt.value} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{opt.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${opt.color} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* User feedback form */}
        {!hasUserTag && !submitted && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {!connected ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  const event = new CustomEvent('openWalletConnect');
                  window.dispatchEvent(event);
                }}
              >
                <Wallet className="h-3.5 w-3.5" />
                Connect to share feedback
              </Button>
            ) : (
              <>
                <p className="text-sm font-medium">How do you know this project?</p>
                <div className="flex gap-2">
                  {AWARENESS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedAwareness(opt.value)}
                      className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all
                        ${
                          selectedAwareness === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-border hover:bg-muted/30'
                        }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {selectedAwareness && (
                  <>
                    <p className="text-sm font-medium">How would you rate it?</p>
                    <div className="flex gap-2">
                      {RATING_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedRating(opt.value)}
                          className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all
                            ${
                              selectedRating === opt.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border/50 hover:border-border hover:bg-muted/30'
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {selectedAwareness && selectedRating && (
                  <Button size="sm" onClick={submit} disabled={submitting} className="gap-1.5">
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {(hasUserTag || submitted) && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4 motion-safe:animate-scale-in" />
              <span>Thanks for your feedback!</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setSubmitted(false);
                setSelectedAwareness(results?.userTag?.awareness ?? null);
                setSelectedRating(results?.userTag?.rating ?? null);
              }}
            >
              Update
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
