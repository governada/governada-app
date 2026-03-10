'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { loadMatchProfile, alignmentDistance, distanceToMatchScore } from '@/lib/matchStore';
import { computeDimensionAgreement } from '@/lib/matching/dimensionAgreement';
import type { AlignmentScores } from '@/lib/drepIdentity';

interface MatchContextBadgeProps {
  /** The DRep's alignment scores — used to compute match against stored user profile. */
  drepAlignments: AlignmentScores;
  /** If an explicit match score is already provided (e.g. from URL param), skip localStorage. */
  existingMatchScore?: number | null;
}

/**
 * Shows "Your match: X%" when the user has completed Quick Match and the
 * current DRep can be scored against their stored governance preferences.
 *
 * Hover/tap reveals which dimensions you agree/differ on.
 */
export function MatchContextBadge({ drepAlignments, existingMatchScore }: MatchContextBadgeProps) {
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [agreeDims, setAgreeDims] = useState<string[]>([]);
  const [differDims, setDifferDims] = useState<string[]>([]);

  useEffect(() => {
    if (existingMatchScore != null && existingMatchScore > 0) return;

    const profile = loadMatchProfile();
    if (!profile) return;

    const distance = alignmentDistance(profile.userAlignments, drepAlignments);
    const score = distanceToMatchScore(distance);
    if (score > 0) {
      setMatchScore(score);
      const { agreeDimensions, differDimensions } = computeDimensionAgreement(
        profile.userAlignments,
        drepAlignments,
      );
      setAgreeDims(agreeDimensions);
      setDifferDims(differDimensions);
    }
  }, [drepAlignments, existingMatchScore]);

  if (matchScore === null) return null;

  const hasExplanation = agreeDims.length > 0 || differDims.length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs gap-1 border-primary/30 bg-primary/5 text-primary cursor-help"
          >
            <Sparkles className="h-3 w-3" />
            Your match: {matchScore}%
          </Badge>
        </TooltipTrigger>
        {hasExplanation && (
          <TooltipContent side="bottom" className="max-w-64 space-y-1.5">
            {agreeDims.length > 0 && (
              <p className="text-xs">
                <span className="font-medium text-emerald-500">Aligned:</span>{' '}
                {agreeDims.join(', ')}
              </p>
            )}
            {differDims.length > 0 && (
              <p className="text-xs">
                <span className="font-medium text-rose-400">Differ:</span> {differDims.join(', ')}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">Based on your Quick Match answers</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
