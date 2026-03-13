'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getStoredSession } from '@/lib/supabaseAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntitySubscription {
  entity_type: string;
  entity_id: string;
  created_at: string;
}

interface WatchEntityButtonProps {
  entityType: 'drep' | 'spo' | 'proposal' | 'cc_member';
  entityId: string;
  size?: 'sm' | 'default';
  className?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchSubscriptions(): Promise<EntitySubscription[]> {
  const token = getStoredSession();
  if (!token) return [];
  const res = await fetch('/api/user/entity-subscriptions', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.subscriptions ?? [];
}

async function subscribe(entityType: string, entityId: string): Promise<void> {
  const token = getStoredSession();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/user/entity-subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
  });
  if (!res.ok) throw new Error('Failed to subscribe');
}

async function unsubscribe(entityType: string, entityId: string): Promise<void> {
  const token = getStoredSession();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch('/api/user/entity-subscriptions', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ entity_type: entityType, entity_id: entityId }),
  });
  if (!res.ok) throw new Error('Failed to unsubscribe');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WatchEntityButton({
  entityType,
  entityId,
  size = 'default',
  className,
}: WatchEntityButtonProps) {
  const { stakeAddress } = useSegment();
  const queryClient = useQueryClient();

  // Don't render for anonymous users
  if (!stakeAddress) return null;

  return (
    <WatchEntityButtonInner
      entityType={entityType}
      entityId={entityId}
      size={size}
      className={className}
      queryClient={queryClient}
    />
  );
}

/**
 * Inner component that only mounts when the user is authenticated.
 * Separated so the early-return in the parent doesn't violate the rules of hooks.
 */
function WatchEntityButtonInner({
  entityType,
  entityId,
  size,
  className,
  queryClient,
}: WatchEntityButtonProps & {
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { data: subscriptions = [] } = useQuery<EntitySubscription[]>({
    queryKey: ['entity-subscriptions'],
    queryFn: fetchSubscriptions,
    staleTime: 60_000,
  });

  const isWatching = subscriptions.some(
    (s) => s.entity_type === entityType && s.entity_id === entityId,
  );

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: () =>
      isWatching ? unsubscribe(entityType, entityId) : subscribe(entityType, entityId),

    // Optimistic update
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['entity-subscriptions'] });
      const previous = queryClient.getQueryData<EntitySubscription[]>(['entity-subscriptions']);

      queryClient.setQueryData<EntitySubscription[]>(['entity-subscriptions'], (old = []) => {
        if (isWatching) {
          return old.filter((s) => !(s.entity_type === entityType && s.entity_id === entityId));
        }
        return [
          ...old,
          { entity_type: entityType, entity_id: entityId, created_at: new Date().toISOString() },
        ];
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['entity-subscriptions'], context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-subscriptions'] });
    },
  });

  const buttonSize = size === 'sm' ? 'icon-xs' : 'icon-sm';
  const iconClass = size === 'sm' ? 'size-3' : 'size-3.5';
  const label = isWatching ? 'Stop watching' : 'Watch';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isWatching ? 'default' : 'outline'}
            size={buttonSize}
            aria-label={label}
            disabled={isPending}
            onClick={() => toggle()}
            className={cn(
              'transition-all',
              isWatching && 'bg-primary/90 hover:bg-primary/70',
              className,
            )}
          >
            {isPending ? (
              <Loader2 className={cn(iconClass, 'animate-spin')} />
            ) : isWatching ? (
              <EyeOff className={iconClass} />
            ) : (
              <Eye className={iconClass} />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
