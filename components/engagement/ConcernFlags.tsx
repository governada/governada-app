'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Info, Wallet } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { useConcernFlags } from '@/hooks/useEngagement';
import { CONCERN_FLAG_LABELS } from '@/lib/engagement/labels';
import type { ConcernFlagType } from '@/lib/api/schemas/engagement';

interface ConcernFlagsProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
}

export function ConcernFlags({ txHash, proposalIndex, isOpen }: ConcernFlagsProps) {
  const { connected, isAuthenticated, authenticate } = useWallet();
  const queryClient = useQueryClient();
  const { data: results, isLoading, refetch } = useConcernFlags(txHash, proposalIndex);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['concern-flags', txHash, proposalIndex];

  const toggleFlag = async (flagType: ConcernFlagType) => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    const token = getStoredSession();
    if (!token) return;

    const isRemoving = results?.userFlags.includes(flagType);
    setSubmitting(flagType);
    setError(null);

    // Optimistic update
    const previousData = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, (old: typeof results) => {
      if (!old) return old;
      const flags = { ...old.flags };
      const userFlags = [...old.userFlags];
      let total = old.total;
      if (isRemoving) {
        flags[flagType] = Math.max(0, (flags[flagType] || 0) - 1);
        total = Math.max(0, total - 1);
        const idx = userFlags.indexOf(flagType);
        if (idx >= 0) userFlags.splice(idx, 1);
      } else {
        flags[flagType] = (flags[flagType] || 0) + 1;
        total += 1;
        userFlags.push(flagType);
      }
      return { ...old, flags, userFlags, total };
    });

    try {
      const res = await fetch('/api/engagement/concerns', {
        method: isRemoving ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposalTxHash: txHash,
          proposalIndex,
          flagType,
        }),
      });

      if (!res.ok && res.status !== 409) {
        throw new Error('Failed to update flag');
      }

      await refetch();

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture(isRemoving ? 'citizen_concern_removed' : 'citizen_concern_flagged', {
            proposal_tx_hash: txHash,
            proposal_index: proposalIndex,
            flag_type: flagType,
          });
        })
        .catch(() => {});
    } catch (err) {
      // Rollback on error
      if (previousData) queryClient.setQueryData(queryKey, previousData);
      setError(err instanceof Error ? err.message : 'Failed to update flag');
    } finally {
      setSubmitting(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-32" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const flags = results?.flags ?? {};
  const userFlags = results?.userFlags ?? [];
  const totalFlags = results?.total ?? 0;

  // Sort flags: user's flags first, then by count descending
  const sortedFlags = (Object.keys(CONCERN_FLAG_LABELS) as ConcernFlagType[]).sort((a, b) => {
    const aUser = userFlags.includes(a) ? 1 : 0;
    const bUser = userFlags.includes(b) ? 1 : 0;
    if (aUser !== bUser) return bUser - aUser;
    return (flags[b] || 0) - (flags[a] || 0);
  });

  return (
    <Card aria-label="Citizen concerns about this proposal">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Citizen Concerns
            {totalFlags > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalFlags}
              </Badge>
            )}
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[260px]">
                <p className="text-xs">
                  Flag specific concerns about this proposal. Aggregated flags help DReps and the
                  community identify systemic issues.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!connected && isOpen && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
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
              Connect to flag concerns
            </Button>
          </div>
        )}

        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Flag concerns about this proposal"
        >
          {sortedFlags.map((flagType) => {
            const count = flags[flagType] || 0;
            const isUserFlag = userFlags.includes(flagType);
            const { label, emoji } = CONCERN_FLAG_LABELS[flagType];
            const isSubmittingThis = submitting === flagType;

            return (
              <button
                key={flagType}
                onClick={() => isOpen && connected && toggleFlag(flagType)}
                disabled={!isOpen || !connected || isSubmittingThis}
                aria-pressed={isUserFlag}
                aria-label={`${label}${count > 0 ? `, ${count} flag${count !== 1 ? 's' : ''}` : ''}`}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                  transition-all duration-150 border
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                  ${
                    isUserFlag
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                      : count > 0
                        ? 'bg-muted/50 border-border text-foreground hover:bg-muted'
                        : 'bg-transparent border-border/50 text-muted-foreground hover:border-border hover:bg-muted/30'
                  }
                  ${isOpen && connected ? 'cursor-pointer motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]' : 'cursor-default'}
                  ${isSubmittingThis ? 'opacity-50' : ''}
                `}
              >
                <span aria-hidden="true">{emoji}</span>
                <span>{label}</span>
                {count > 0 && (
                  <span className="ml-0.5 tabular-nums opacity-70" aria-hidden="true">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {totalFlags === 0 && (
          <p className="text-xs text-muted-foreground">No concerns flagged yet.</p>
        )}

        <div aria-live="polite" role="status">
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
