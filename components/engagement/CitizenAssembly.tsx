'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Vote, Clock, CheckCircle2, Wallet, Users } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { useActiveAssembly } from '@/hooks/useEngagement';

export function CitizenAssembly() {
  const { connected, isAuthenticated, authenticate } = useWallet();
  const { data: assembly, isLoading, refetch } = useActiveAssembly();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stagger result bar animation
  const hasResults = !!assembly && (!!assembly.userVote || assembly.totalVotes > 0);
  const [barsVisible, setBarsVisible] = useState(false);
  useEffect(() => {
    if (hasResults) {
      const t = setTimeout(() => setBarsVisible(true), 100);
      return () => clearTimeout(t);
    }
  }, [hasResults]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!assembly) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Vote className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No active citizen assembly right now. Check back next epoch.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasVoted = !!assembly.userVote;
  const closesAt = new Date(assembly.closesAt);
  const timeLeft = closesAt.getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(timeLeft / (1000 * 60 * 60 * 24)));

  const submit = async () => {
    if (!selectedOption) return;

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
      const res = await fetch('/api/engagement/assembly/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assemblyId: assembly.id,
          selectedOption,
        }),
      });

      if (res.status === 429) {
        throw new Error(
          "You've been active! You've reached the vote limit for this epoch — resets next epoch.",
        );
      }
      if (!res.ok && res.status !== 409) throw new Error('Failed to cast vote');

      await refetch();

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_assembly_voted', {
            assembly_id: assembly.id,
            selected_option: selectedOption,
          });
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cast vote');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="ring-1 ring-primary/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            Citizen Assembly
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left` : 'Closing soon'}
            </Badge>
            <Badge variant="outline" className="gap-1">
              Epoch {assembly.epoch}
            </Badge>
          </div>
        </div>
        {assembly.description && (
          <p className="text-sm text-muted-foreground mt-1">{assembly.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-base font-semibold">{assembly.question}</p>

        {/* Show results if user has voted or assembly results exist */}
        {(hasVoted || assembly.totalVotes > 0) && (
          <div className="space-y-2">
            {assembly.results?.map((opt, idx) => {
              const isUserChoice = assembly.userVote === opt.key;
              return (
                <div key={opt.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isUserChoice ? 'font-semibold' : ''}>
                      {opt.label}
                      {isUserChoice && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary inline ml-1.5 motion-safe:animate-scale-in" />
                      )}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {opt.count} ({opt.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        isUserChoice ? 'bg-primary' : 'bg-primary/40'
                      }`}
                      style={{
                        width: barsVisible ? `${opt.percentage}%` : '0%',
                        transitionDelay: `${idx * 120}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {assembly.totalVotes} citizen{assembly.totalVotes !== 1 ? 's' : ''} voted
            </p>
            {assembly.quorumThreshold != null && assembly.quorumThreshold > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Quorum progress</span>
                  <span className="tabular-nums">
                    {assembly.totalVotes} / {assembly.quorumThreshold}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      assembly.totalVotes >= assembly.quorumThreshold
                        ? 'bg-green-500'
                        : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (assembly.totalVotes / assembly.quorumThreshold) * 100)}%`,
                    }}
                  />
                </div>
                {assembly.totalVotes < assembly.quorumThreshold && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {assembly.quorumThreshold - assembly.totalVotes} more vote
                    {assembly.quorumThreshold - assembly.totalVotes !== 1 ? 's' : ''} needed for
                    quorum
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Voting options (if not voted) */}
        {!hasVoted && (
          <div className="space-y-3">
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
                <div className="space-y-2">
                  {assembly.options.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        hapticLight();
                        setSelectedOption(opt.key);
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-all hover:scale-[1.01] active:scale-[0.99]
                        ${
                          selectedOption === opt.key
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border/50 hover:border-border hover:bg-muted/30'
                        }`}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      {opt.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                      )}
                    </button>
                  ))}
                </div>

                {selectedOption && (
                  <div className="space-y-2">
                    <Button onClick={submit} disabled={submitting} className="w-full gap-1.5">
                      <Vote className="h-4 w-4" />
                      {submitting ? 'Submitting...' : 'Cast Your Vote'}
                    </Button>
                    {error && <p className="text-xs text-destructive">{error}</p>}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {hasVoted && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4 motion-safe:animate-scale-in" />
            <span className="motion-safe:animate-fade-in-up">
              Your voice has been recorded. Results update live.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
