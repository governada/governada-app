'use client';

import { useEffect } from 'react';
import { useExplorePath } from '@/hooks/useExplorePath';
import { useEntityConnections } from '@/hooks/useEntityConnections';
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
 * Wrapper that provides EntityConnections panel, ExplorePath breadcrumb with
 * next-step suggestions, and auto-registers the entity visit.
 */
export function EntityPageConnections({
  entityType,
  entityId,
  entityLabel,
  entityHref,
}: EntityPageConnectionsProps) {
  const { pushEntity } = useExplorePath();
  const { data } = useEntityConnections(entityType, entityId);

  useEffect(() => {
    pushEntity(entityType, entityId, entityLabel, entityHref);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only register once on mount
  }, [entityType, entityId]);

  // Derive suggestions from non-personalized connections that link to other entities
  const suggestions = (data?.connections ?? []).filter(
    (c) => !c.personalized && c.href !== entityHref,
  );

  return (
    <div className="flex flex-col gap-2">
      <ExplorePath suggestions={suggestions} />
      <EntityConnections entityType={entityType} entityId={entityId} />
    </div>
  );
}
