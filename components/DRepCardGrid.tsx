'use client';

import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { EnrichedDRep } from '@/lib/koios';
import { DRepCard } from '@/components/DRepCard';
import { EmptyState } from '@/components/EmptyState';

interface DRepCardGridProps {
  dreps: EnrichedDRep[];
  matchData?: Record<string, number>;
  matchConfidence?: Record<string, number>;
  watchlist?: string[];
  onWatchlistToggle?: (drepId: string) => void;
  delegatedDrepId?: string | null;
  onCardClick?: (drep: EnrichedDRep) => void;
}

export function DRepCardGrid({
  dreps,
  matchData = {},
  matchConfidence = {},
  watchlist = [],
  onWatchlistToggle,
  delegatedDrepId,
  onCardClick,
}: DRepCardGridProps) {
  const router = useRouter();

  if (dreps.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No DReps to display"
        message="No representatives match the current criteria. Try adjusting your filters."
        compact
        component="DRepCardGrid"
      />
    );
  }

  const handleClick = (drep: EnrichedDRep) => {
    if (onCardClick) {
      onCardClick(drep);
    } else {
      const match = matchData[drep.drepId];
      const matchParam = match != null ? `?match=${Math.round(match)}` : '';
      router.push(`/drep/${encodeURIComponent(drep.drepId)}${matchParam}`);
    }
  };

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      role="list"
      aria-label="DRep representatives"
    >
      {dreps.map((drep) => (
        <DRepCard
          key={drep.drepId}
          drep={drep}
          matchScore={matchData[drep.drepId] ?? null}
          matchConfidence={matchConfidence[drep.drepId] ?? null}
          isWatchlisted={watchlist.includes(drep.drepId)}
          onWatchlistToggle={onWatchlistToggle}
          isDelegated={delegatedDrepId === drep.drepId}
          onClick={() => handleClick(drep)}
        />
      ))}
    </div>
  );
}
