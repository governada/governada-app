'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { RadarOverlay } from './RadarOverlay';
import { cn } from '@/lib/utils';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { ConfidenceBreakdown } from '@/lib/matching/confidence';
import { generateMatchNarrative } from '@/lib/matching/matchNarrative';

interface MatchCardProps {
  rank: number;
  drepId: string;
  drepName: string | null;
  matchScore: number;
  confidence: number;
  agreed: number;
  overlapping: number;
  agreeDimensions?: string[];
  differDimensions?: string[];
  userAlignments?: AlignmentScores | null;
  drepAlignments?: AlignmentScores | null;
  identityColor?: string;
  showRadar?: boolean;
  confidenceBreakdown?: ConfidenceBreakdown;
  className?: string;
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 80) return 'high confidence';
  if (confidence >= 40) return 'medium confidence';
  return 'low confidence';
}

export function MatchCard({
  rank,
  drepId,
  drepName,
  matchScore,
  confidence,
  agreed,
  overlapping,
  agreeDimensions,
  differDimensions,
  userAlignments,
  drepAlignments,
  identityColor,
  showRadar = true,
  confidenceBreakdown,
  className,
}: MatchCardProps) {
  const displayName = drepName || drepId.slice(0, 12) + '...';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Radar overlay */}
          {showRadar && userAlignments && drepAlignments && (
            <div className="hidden sm:block shrink-0">
              <RadarOverlay
                userAlignments={userAlignments}
                drepAlignments={drepAlignments}
                size={120}
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: identityColor || 'hsl(var(--primary))' }}
                >
                  {rank}
                </span>
                <Link
                  href={`/drep/${encodeURIComponent(drepId)}`}
                  className="font-medium text-sm hover:text-primary transition-colors truncate"
                >
                  {displayName}
                </Link>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 tabular-nums',
                  matchScore >= 70
                    ? 'text-green-600 border-green-600/30'
                    : matchScore >= 50
                      ? 'text-amber-600 border-amber-600/30'
                      : 'text-muted-foreground',
                )}
              >
                {matchScore}% match
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              {getConfidenceLabel(confidence)} · agreed on {agreed}/{overlapping}
            </p>

            {/* Dimension agreement */}
            {(agreeDimensions?.length || differDimensions?.length) && (
              <p className="text-xs text-muted-foreground">
                {agreeDimensions?.length ? (
                  <>
                    <span className="text-green-600 dark:text-green-400">Agree on: </span>
                    {agreeDimensions.join(', ')}
                  </>
                ) : null}
                {agreeDimensions?.length && differDimensions?.length ? '. ' : ''}
                {differDimensions?.length ? (
                  <>
                    <span className="text-amber-600 dark:text-amber-400">Differ on: </span>
                    {differDimensions.join(', ')}
                  </>
                ) : null}
              </p>
            )}

            {/* Match narrative */}
            {(agreeDimensions?.length || differDimensions?.length) && (
              <p className="text-sm text-muted-foreground">
                {generateMatchNarrative({
                  agreeDimensions: agreeDimensions ?? [],
                  differDimensions: differDimensions ?? [],
                  confidence: confidenceBreakdown,
                })}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Link href={`/drep/${encodeURIComponent(drepId)}`}>
                <Button variant="outline" size="sm" className="text-xs gap-1 h-7">
                  View Profile <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
