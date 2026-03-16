'use client';

/**
 * ScoreImpactPreview — compact motivational badge showing score gain from voting.
 *
 * Pure client-side calculation. Shows e.g. "+3 engagement if you vote with rationale".
 * Intended to be placed near the vote buttons as motivation.
 */

import { useMemo } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estimateScoreImpact } from '@/lib/workspace/scoreImpact';

interface ScoreImpactPreviewProps {
  currentScore?: number;
  totalProposals: number;
  votedCount: number;
}

export function ScoreImpactPreview({
  currentScore,
  totalProposals,
  votedCount,
}: ScoreImpactPreviewProps) {
  const impact = useMemo(
    () => estimateScoreImpact({ currentScore, totalProposals, votedCount }),
    [currentScore, totalProposals, votedCount],
  );

  // Don't show if no meaningful impact
  if (impact.estimatedScoreGain < 0.1) return null;

  const hasRationaleBoost = impact.rationaleBoost > 0;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'bg-primary/10 text-primary text-xs font-medium',
        'border border-primary/20',
      )}
    >
      <TrendingUp className="h-3 w-3" />
      <span>+{impact.estimatedScoreGain} score if you vote</span>
      {hasRationaleBoost && (
        <>
          <span className="text-primary/50">|</span>
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span className="text-amber-600 dark:text-amber-400">
            +{impact.rationaleBoost} with rationale
          </span>
        </>
      )}
    </div>
  );
}
