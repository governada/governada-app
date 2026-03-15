'use client';

import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import type { EntityType, EntityConnection } from '@/lib/entityConnections';

/**
 * Fetch entity connections for the Connected Graph panel.
 * Automatically includes viewer's DRep for personalization.
 */
export function useEntityConnections(entityType: EntityType, entityId: string) {
  const { delegatedDrep, stakeAddress } = useSegment();

  const params = new URLSearchParams({
    type: entityType,
    id: entityId,
  });
  if (delegatedDrep) params.set('viewerDrepId', delegatedDrep);
  if (stakeAddress) params.set('viewerStakeAddress', stakeAddress);

  return useQuery<{ connections: EntityConnection[] }>({
    queryKey: ['entity-connections', entityType, entityId, delegatedDrep, stakeAddress],
    queryFn: async () => {
      const res = await fetch(`/api/entity-connections?${params}`);
      if (!res.ok) return { connections: [] };
      return res.json();
    },
    staleTime: 15 * 60_000, // 15 minutes
    enabled: !!entityId,
  });
}
