'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface PersonalizedStatsStripProps {
  drepName?: string;
  drepScore?: number;
  scoreTrend?: number | null;
  openProposals?: number;
  governanceLevel?: string;
  visitStreak?: number;
  walletAddress: string;
}

export function PersonalizedStatsStrip({
  drepName,
  drepScore,
  scoreTrend,
  openProposals,
  governanceLevel,
  visitStreak,
}: PersonalizedStatsStripProps) {
  const items: React.ReactNode[] = [];

  if (drepName != null) {
    const TrendIcon =
      scoreTrend != null && scoreTrend > 0
        ? TrendingUp
        : scoreTrend != null && scoreTrend < 0
          ? TrendingDown
          : Minus;
    const trendColor =
      scoreTrend != null && scoreTrend > 0
        ? 'text-emerald-400'
        : scoreTrend != null && scoreTrend < 0
          ? 'text-red-400'
          : 'text-white/50';
    items.push(
      <span key="drep" className="flex items-center gap-1.5">
        <span className="text-white/80">
          Your DRep: {drepName} — scored {drepScore ?? 0}
        </span>
        <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
      </span>,
    );
  }

  if (openProposals != null && openProposals > 0) {
    items.push(
      <span key="proposals" className="text-amber-400">
        {openProposals} proposals need attention
      </span>,
    );
  }

  if (governanceLevel) {
    items.push(
      <span key="level" className="text-white/50">
        Level: {governanceLevel}
      </span>,
    );
  }

  if (visitStreak != null && visitStreak > 1) {
    items.push(
      <span key="streak" className="text-white/80">
        🔥 {visitStreak} day streak
      </span>,
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-4 animate-fade-in-up animation-delay-200">
      <div className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl bg-white/5 px-4 py-2 backdrop-blur-sm">
        {items.reduce<React.ReactNode[]>((acc, item, i) => {
          if (i > 0) {
            acc.push(
              <span key={`div-${i}`} className="text-white/20">
                |
              </span>,
            );
          }
          acc.push(item);
          return acc;
        }, [])}
      </div>
    </div>
  );
}
