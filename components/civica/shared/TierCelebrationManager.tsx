'use client';

import { useEffect, useState } from 'react';
import { CelebrationOverlay } from './CelebrationOverlay';

interface TierChange {
  id: string;
  old_tier: string;
  new_tier: string;
  old_score: number;
  new_score: number;
  epoch_no: number;
  created_at: string;
}

interface TierCelebrationManagerProps {
  entityType: 'drep' | 'spo';
  entityId: string;
  entityName: string;
  enabled: boolean;
  ogImageUrl?: string;
  shareUrl?: string;
}

export function TierCelebrationManager({
  entityType,
  entityId,
  entityName,
  enabled,
  ogImageUrl,
  shareUrl,
}: TierCelebrationManagerProps) {
  const [change, setChange] = useState<TierChange | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const storageKey = `tier_celebration_seen_${entityType}_${entityId}`;
    const lastVisit = localStorage.getItem(storageKey);

    if (!lastVisit) {
      // First ever visit — record timestamp but don't celebrate
      localStorage.setItem(storageKey, Date.now().toString());
      return;
    }

    const apiPath =
      entityType === 'drep'
        ? `/api/drep/${encodeURIComponent(entityId)}/tier-changes?since=${lastVisit}`
        : `/api/spo/${encodeURIComponent(entityId)}/tier-changes?since=${lastVisit}`;

    fetch(apiPath)
      .then((r) => r.json())
      .then((json: { data?: TierChange[] }) => {
        if (json.data && json.data.length > 0) {
          setChange(json.data[0]);
        }
      })
      .catch(() => {
        // Silently fail — celebration is non-critical
      });
  }, [enabled, entityType, entityId]);

  const handleDismiss = () => {
    const storageKey = `tier_celebration_seen_${entityType}_${entityId}`;
    localStorage.setItem(storageKey, Date.now().toString());
    setChange(null);
  };

  if (!change) return null;

  const shareText = `${entityName} just reached the ${change.new_tier} tier on DRepScore! Score: ${change.new_score}`;

  return (
    <CelebrationOverlay
      entityType={entityType}
      entityId={entityId}
      entityName={entityName}
      oldTier={change.old_tier}
      newTier={change.new_tier}
      newScore={change.new_score}
      onDismiss={handleDismiss}
      ogImageUrl={ogImageUrl}
      shareText={shareText}
      shareUrl={shareUrl}
    />
  );
}
