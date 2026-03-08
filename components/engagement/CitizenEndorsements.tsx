'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Heart,
  Info,
  RefreshCw,
  RotateCcw,
  Wallet,
  Check,
  Landmark,
  Code2,
  MessageSquare,
  Users,
} from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { useEndorsements, type EndorsementResults } from '@/hooks/useEngagement';
import type { EndorsementType } from '@/lib/api/schemas/engagement';

const ENDORSEMENT_CONFIG: {
  type: EndorsementType;
  label: string;
  icon: typeof Heart;
}[] = [
  { type: 'general', label: 'General', icon: Heart },
  { type: 'treasury_oversight', label: 'Treasury', icon: Landmark },
  { type: 'technical_expertise', label: 'Technical', icon: Code2 },
  { type: 'communication', label: 'Communication', icon: MessageSquare },
  { type: 'community_leadership', label: 'Community', icon: Users },
];

interface CitizenEndorsementsProps {
  entityType: 'drep' | 'spo';
  entityId: string;
}

export function CitizenEndorsements({ entityType, entityId }: CitizenEndorsementsProps) {
  const { connected, isAuthenticated, authenticate } = useWallet();
  const queryClient = useQueryClient();
  const { data: results, isLoading, isError, refetch } = useEndorsements(entityType, entityId);

  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['endorsements', entityType, entityId];

  const toggleEndorsement = async (endorsementType: EndorsementType) => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    setToggling(endorsementType);
    setError(null);

    // Optimistic update
    const previousData = queryClient.getQueryData<EndorsementResults>(queryKey);
    queryClient.setQueryData<EndorsementResults>(queryKey, (old) => {
      if (!old) return old;
      const isRemoving = old.userEndorsements.includes(endorsementType);
      const newByType = { ...old.byType };
      let newUserEndorsements: string[];

      if (isRemoving) {
        newByType[endorsementType] = Math.max(0, (newByType[endorsementType] || 0) - 1);
        newUserEndorsements = old.userEndorsements.filter((t) => t !== endorsementType);
      } else {
        newByType[endorsementType] = (newByType[endorsementType] || 0) + 1;
        newUserEndorsements = [...old.userEndorsements, endorsementType];
      }

      const newTotal = Object.values(newByType).reduce((sum, n) => sum + n, 0);
      return { ...old, byType: newByType, total: newTotal, userEndorsements: newUserEndorsements };
    });

    try {
      const token = getStoredSession();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/engagement/endorsements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ entityType, entityId, endorsementType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Endorsement failed');
      }

      await refetch();

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_endorsement_toggled', {
            entity_type: entityType,
            entity_id: entityId,
            endorsement_type: endorsementType,
          });
        })
        .catch(() => {});
    } catch (err) {
      if (previousData) queryClient.setQueryData(queryKey, previousData);
      setError(err instanceof Error ? err.message : 'Endorsement failed');
    } finally {
      setToggling(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="ring-1 ring-border/50">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <div className="flex flex-wrap gap-1.5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="ring-1 ring-border/50">
        <CardContent className="py-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">Couldn&apos;t load endorsements</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="mr-1.5 h-3 w-3" />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const total = results?.total ?? 0;
  const byType = results?.byType ?? {};
  const userEndorsements = new Set(results?.userEndorsements ?? []);
  const hasEndorsed = userEndorsements.size > 0;

  return (
    <Card className="ring-1 ring-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5 text-muted-foreground font-medium">
            <Heart className="h-3.5 w-3.5" />
            Citizen Endorsements
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[240px]">
                <p className="text-xs">
                  Endorse this {entityType === 'drep' ? 'DRep' : 'SPO'} to signal your trust.
                  Endorsements are social proof alongside the algorithmic score.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Summary line */}
        {total > 0 && (
          <p className="text-xs text-muted-foreground">
            Endorsed by <span className="font-medium text-foreground tabular-nums">{total}</span>{' '}
            citizen
            {total !== 1 ? 's' : ''}
            {hasEndorsed && <span className="text-primary"> (including you)</span>}
          </p>
        )}

        {total === 0 && !connected && (
          <p className="text-xs text-muted-foreground">
            No endorsements yet. Be the first to endorse.
          </p>
        )}

        {/* Endorsement type pills */}
        {connected && (
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={`Endorse this ${entityType === 'drep' ? 'DRep' : 'SPO'}`}
          >
            {ENDORSEMENT_CONFIG.map(({ type, label, icon: Icon }) => {
              const isActive = userEndorsements.has(type);
              const count = byType[type] || 0;
              const isCurrentlyToggling = toggling === type;

              return (
                <button
                  key={type}
                  onClick={() => toggleEndorsement(type)}
                  disabled={toggling !== null}
                  aria-pressed={isActive}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all duration-150 border
                    motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97]
                    ${
                      isActive
                        ? 'bg-primary/10 border-primary/30 text-primary'
                        : 'bg-transparent border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                    }
                    ${toggling !== null && !isCurrentlyToggling ? 'opacity-50' : ''}
                  `}
                >
                  {isCurrentlyToggling ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : isActive ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  {label}
                  {count > 0 && <span className="ml-0.5 tabular-nums opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* CTA for unconnected users */}
        {!connected && (
          <div className="relative">
            <div className="opacity-30 pointer-events-none blur-[1px]">
              <div className="flex flex-wrap gap-1.5">
                {ENDORSEMENT_CONFIG.map(({ type, label, icon: Icon }) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs border border-border/60"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                onClick={() => {
                  const event = new CustomEvent('open-wallet-modal');
                  window.dispatchEvent(event);
                }}
              >
                <Wallet className="h-3 w-3" />
                Connect to Endorse
              </Button>
            </div>
          </div>
        )}

        {/* Type breakdown when there are endorsements and user is not connected */}
        {total > 0 && !connected && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {ENDORSEMENT_CONFIG.filter(({ type }) => (byType[type] || 0) > 0).map(
              ({ type, label }) => (
                <span key={type}>
                  {byType[type]} {label.toLowerCase()}
                </span>
              ),
            )}
          </div>
        )}

        <div aria-live="polite" role="status">
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
