'use client';

import { useEffect } from 'react';
import { useExplorePath } from '@/hooks/useExplorePath';
import { EntityConnections } from './EntityConnections';
import { ExplorePath } from './ExplorePath';
import type { EntityType } from '@/lib/entityConnections';

interface EntityPageConnectionsProps {
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  entityHref: string;
}

/**
 * Wrapper that provides both EntityConnections panel and ExplorePath breadcrumb
 * for entity pages. Automatically registers the entity visit in the explore path.
 *
 * Usage: Add <EntityPageConnections ... /> near the top of any entity page.
 */
export function EntityPageConnections({
  entityType,
  entityId,
  entityLabel,
  entityHref,
}: EntityPageConnectionsProps) {
  const { pushEntity } = useExplorePath();

  useEffect(() => {
    pushEntity(entityType, entityId, entityLabel, entityHref);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only register once on mount
  }, [entityType, entityId]);

  return (
    <div className="flex flex-col gap-2">
      <ExplorePath />
      <EntityConnections entityType={entityType} entityId={entityId} />
    </div>
  );
}
