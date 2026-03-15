'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/utils/wallet-context';
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

interface MilestoneResult {
  personalBest: boolean;
  score: number;
  previousBest: number;
  newlyThresholds: number[];
}

interface TierCelebrationManagerProps {
  entityType: 'drep' | 'spo';
  entityId: string;
  entityName: string;
  /** For SPO profiles: the userId that claimed this pool */
  claimedBy?: string | null;
  ogImageUrl?: string;
  shareUrl?: string;
}

export function TierCelebrationManager({
  entityType,
  entityId,
  entityName,
  claimedBy,
  ogImageUrl,
  shareUrl,
}: TierCelebrationManagerProps) {
  const { isAuthenticated, ownDRepId, userId } = useWallet();
  const [change, setChange] = useState<TierChange | null>(null);
  const [milestone, setMilestone] = useState<{ score: number } | null>(null);

  const isOwner =
    isAuthenticated &&
    (entityType === 'drep' ? ownDRepId === entityId : !!claimedBy && userId === claimedBy);

  useEffect(() => {
    if (!isOwner) return;

    const storageKey = `tier_celebration_seen_${entityType}_${entityId}`;
    const lastVisit = localStorage.getItem(storageKey);

    if (!lastVisit) {
      localStorage.setItem(storageKey, Date.now().toString());
      return;
    }

    const tierApiPath =
      entityType === 'drep'
        ? `/api/drep/${encodeURIComponent(entityId)}/tier-changes?since=${lastVisit}`
        : `/api/spo/${encodeURIComponent(entityId)}/tier-changes?since=${lastVisit}`;

    fetch(tierApiPath)
      .then((r) => r.json())
      .then((json: { data?: TierChange[] }) => {
        if (json.data && json.data.length > 0) {
          setChange(json.data[0]);
          return;
        }
        // No tier change — check for personal best (DRep only)
        if (entityType === 'drep') {
          fetch(`/api/drep/${encodeURIComponent(entityId)}/milestones?since=${lastVisit}`)
            .then((r) => r.json())
            .then((m: MilestoneResult) => {
              if (m.personalBest) {
                setMilestone({ score: m.score });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [isOwner, entityType, entityId]);

  const handleDismiss = () => {
    const storageKey = `tier_celebration_seen_${entityType}_${entityId}`;
    localStorage.setItem(storageKey, Date.now().toString());
    setChange(null);
    setMilestone(null);
  };

  if (change) {
    const shareText = `${entityName} just reached the ${change.new_tier} tier on Governada! Score: ${change.new_score}`;
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

  if (milestone) {
    return (
      <CelebrationOverlay
        entityType={entityType}
        entityId={entityId}
        entityName={entityName}
        oldTier="Personal Best"
        newTier="Personal Best"
        newScore={milestone.score}
        onDismiss={handleDismiss}
      />
    );
  }

  return null;
}
