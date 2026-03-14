'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, RefreshCw, Wallet, Check } from 'lucide-react';
import { hapticLight } from '@/lib/haptics';
import { useEndorsements, type EndorsementResults } from '@/hooks/useEngagement';
import type { EndorsementType } from '@/lib/api/schemas/engagement';

interface CitizenEndorsementsProps {
  entityType: 'drep' | 'spo';
  entityId: string;
  /** Compact inline mode (no card wrapper) */
  inline?: boolean;
}

/**
 * Citizen Trust Signal — simplified from 5 categories to a single toggle.
 * Uses 'general' endorsement type. Total count includes all legacy types for continuity.
 */
export function CitizenEndorsements({ entityType, entityId, inline }: CitizenEndorsementsProps) {
  const { connected, isAuthenticated, authenticate } = useWallet();
  const queryClient = useQueryClient();
  const { data: results, isLoading, isError, refetch } = useEndorsements(entityType, entityId);

  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['endorsements', entityType, entityId];
  const endorsementType: EndorsementType = 'general';

  const toggleTrust = async () => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    setToggling(true);
    setError(null);

    const previousData = queryClient.getQueryData<EndorsementResults>(queryKey);
    queryClient.setQueryData<EndorsementResults>(queryKey, (old) => {
      if (!old) return old;
      const isRemoving = old.userEndorsements.includes(endorsementType);
      const newByType = { ...old.byType };

      if (isRemoving) {
        newByType[endorsementType] = Math.max(0, (newByType[endorsementType] || 0) - 1);
        return {
          ...old,
          byType: newByType,
          total: Object.values(newByType).reduce((s, n) => s + n, 0),
          userEndorsements: old.userEndorsements.filter((t) => t !== endorsementType),
        };
      } else {
        newByType[endorsementType] = (newByType[endorsementType] || 0) + 1;
        return {
          ...old,
          byType: newByType,
          total: Object.values(newByType).reduce((s, n) => s + n, 0),
          userEndorsements: [...old.userEndorsements, endorsementType],
        };
      }
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
      setToggling(false);
    }
  };

  const total = results?.total ?? 0;
  const userEndorsements = new Set(results?.userEndorsements ?? []);
  const hasTrusted = userEndorsements.has(endorsementType);
  const entityLabel = entityType === 'drep' ? 'DRep' : 'pool';

  if (isLoading) {
    return inline ? (
      <Skeleton className="h-8 w-32 rounded-full" />
    ) : (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (isError) return null;

  const trustButton = (
    <button
      onClick={
        connected ? toggleTrust : () => window.dispatchEvent(new CustomEvent('openWalletConnect'))
      }
      disabled={toggling}
      aria-pressed={hasTrusted}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 border
        motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97]
        ${
          hasTrusted
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-transparent border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
        }
      `}
    >
      {toggling ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : hasTrusted ? (
        <Check className="h-3.5 w-3.5" />
      ) : connected ? (
        <Heart className="h-3.5 w-3.5" />
      ) : (
        <Wallet className="h-3.5 w-3.5" />
      )}
      {hasTrusted ? 'Trusted' : connected ? 'I Trust' : 'Connect to Trust'}
      {total > 0 && <span className="ml-0.5 tabular-nums opacity-70">{total}</span>}
    </button>
  );

  if (inline) {
    return (
      <div className="flex items-center gap-2">
        {trustButton}
        {total > 0 && !inline && (
          <span className="text-xs text-muted-foreground">
            {total} citizen{total !== 1 ? 's' : ''} trust this {entityLabel}
            {hasTrusted && <span className="text-primary"> — including you</span>}
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        {trustButton}
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {total} citizen{total !== 1 ? 's' : ''} trust this {entityLabel}
            {hasTrusted && <span className="text-primary"> — including you</span>}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
