'use client';

import { Badge } from '@/components/ui/badge';
import { EnrichedDRep } from '@/lib/koios';
import { getDRepDisplayName } from '@/utils/display';
import { formatAda, getSizeBadgeClass } from '@/utils/scoring';
import { getDRepTraitTags } from '@/lib/alignment';
import { ScoreBreakdownTooltip } from './ScoreBreakdown';
import { HexScore } from './HexScore';
import { hapticLight } from '@/lib/haptics';
import { extractAlignments } from '@/lib/drepIdentity';
import { Heart, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DRepCardProps {
  drep: EnrichedDRep;
  matchScore?: number | null;
  matchConfidence?: number | null;
  isWatchlisted?: boolean;
  onWatchlistToggle?: (drepId: string) => void;
  isDelegated?: boolean;
  onClick?: () => void;
}

export function DRepCard({
  drep,
  matchScore,
  matchConfidence,
  isWatchlisted = false,
  onWatchlistToggle,
  isDelegated = false,
  onClick,
}: DRepCardProps) {
  const displayName = getDRepDisplayName(drep);
  const traitTags = getDRepTraitTags(drep);
  const score = drep.drepScore ?? 0;

  const pillarBars = [
    { label: 'Participation', value: drep.effectiveParticipation },
    { label: 'Rationale', value: drep.rationaleRate },
    { label: 'Reliability', value: drep.reliabilityScore },
  ];

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={`${displayName}, score ${score}`}
      className={cn(
        'group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isDelegated && 'ring-2 ring-primary/30',
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Top row: score + name + size */}
      <div className="flex items-start gap-3">
        {/* Score hex */}
        <ScoreBreakdownTooltip drep={drep}>
          <div className="flex flex-col items-center min-w-[48px] cursor-help">
            <HexScore
              score={score}
              alignments={extractAlignments(drep as unknown as Record<string, unknown>)}
              size="card"
              animate={false}
            />
          </div>
        </ScoreBreakdownTooltip>

        {/* Name + handle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{displayName}</span>
            {isDelegated && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary shrink-0"
              >
                Your DRep
              </Badge>
            )}
          </div>
          {drep.handle && (
            <span className="text-xs text-muted-foreground font-mono">{drep.handle}</span>
          )}
        </div>

        {/* Size + power */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge
            variant="outline"
            className={cn('text-[10px] font-medium', getSizeBadgeClass(drep.sizeTier))}
          >
            {drep.sizeTier}
          </Badge>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {formatAda(drep.votingPower)}
          </span>
        </div>
      </div>

      {/* Match score (when user has quiz/poll data) */}
      {matchScore != null && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
          <span className="text-xs font-medium text-primary">{matchScore}% match</span>
          {matchConfidence != null && (
            <span
              className={cn(
                'text-[10px]',
                matchConfidence >= 50 ? 'text-green-500' : 'text-amber-500',
              )}
            >
              · {matchConfidence >= 80 ? 'high' : matchConfidence >= 40 ? 'med' : 'low'}
            </span>
          )}
        </div>
      )}

      {/* Trait tags (fallback when no match data) */}
      {matchScore == null && traitTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {traitTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] font-normal px-2 py-0.5">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Pillar mini-bars */}
      <div className="grid grid-cols-3 gap-2">
        {pillarBars.map((pillar) => (
          <div key={pillar.label} className="space-y-0.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{pillar.label}</span>
              <span className="tabular-nums">{Math.round(pillar.value)}%</span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${Math.min(100, pillar.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1 pt-1 border-t">
        {onWatchlistToggle && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              hapticLight();
              onWatchlistToggle(drep.drepId);
            }}
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
            aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <Heart
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                isWatchlisted
                  ? 'fill-red-500 text-red-500'
                  : 'text-muted-foreground hover:text-red-400',
              )}
            />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          className="p-1.5 hover:bg-muted rounded-full transition-colors"
          aria-label={isDelegated ? 'Your current DRep' : 'View DRep'}
        >
          <Vote
            className={cn(
              'h-3.5 w-3.5 transition-colors',
              isDelegated
                ? 'fill-primary text-primary'
                : 'text-muted-foreground hover:text-primary',
            )}
          />
        </button>
      </div>
    </div>
  );
}
