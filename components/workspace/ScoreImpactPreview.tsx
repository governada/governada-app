'use client';

import { TrendingUp } from 'lucide-react';

interface ScoreImpactPreviewProps {
  pendingCount: number;
  currentParticipationRate: number;
  totalEligibleProposals: number;
  /** Weight of participation pillar in overall score (0-1). Default 0.25 */
  participationWeight?: number;
}

/**
 * Compact callout estimating how many score points a DRep could gain
 * by voting (with rationales) on all pending proposals.
 *
 * Returns null when there are no pending proposals or participation
 * is already at 100%.
 */
export function ScoreImpactPreview({
  pendingCount,
  currentParticipationRate,
  totalEligibleProposals,
  participationWeight = 0.25,
}: ScoreImpactPreviewProps) {
  if (pendingCount <= 0 || totalEligibleProposals <= 0) return null;
  if (currentParticipationRate >= 100) return null;

  // Estimate: voting on all pending raises participation rate; apply weight
  const participationGainPct =
    (pendingCount / totalEligibleProposals) * (100 - currentParticipationRate);
  const estimatedGain = Math.round(participationGainPct * participationWeight);

  if (estimatedGain <= 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      <p className="text-xs text-emerald-600 dark:text-emerald-400">
        Voting on {pendingCount === 1 ? 'this proposal' : `all ${pendingCount} proposals`} with
        rationales: <span className="font-semibold">~+{estimatedGain} points</span>
      </p>
    </div>
  );
}
