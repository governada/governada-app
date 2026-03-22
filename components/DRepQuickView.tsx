'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EnrichedDRep } from '@/lib/koios';
import { getDRepDisplayName } from '@/utils/display';
import { formatAda, getDRepScoreBadgeClass, getSizeBadgeClass } from '@/utils/scoring';
import { getDRepTraitTags } from '@/lib/alignment';
import { ScoreBreakdownTooltip } from './ScoreBreakdown';
import { SocialIcons } from './SocialIcons';
import { Heart, Vote, ExternalLink, Check, X as XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import Link from 'next/link';

export interface MatchComparison {
  proposalTitle: string;
  userVote: string;
  drepVote: string;
  agreed: boolean;
}

export interface DRepMatchDetail {
  matchScore: number;
  agreed: number;
  total: number;
  comparisons: MatchComparison[];
  currentDRepScore?: number | null;
}

interface DRepQuickViewProps {
  drep: EnrichedDRep | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchDetail?: DRepMatchDetail | null;
  isWatchlisted?: boolean;
  onWatchlistToggle?: (drepId: string) => void;
  isDelegated?: boolean;
}

export function DRepQuickView({
  drep,
  open,
  onOpenChange,
  matchDetail,
  isWatchlisted = false,
  onWatchlistToggle,
  isDelegated = false,
}: DRepQuickViewProps) {
  const isMobile = useIsMobile();

  if (!drep) return null;

  const displayName = getDRepDisplayName(drep);
  const traitTags = getDRepTraitTags(drep);
  const score = drep.drepScore ?? 0;

  const pillars = [
    { label: 'Engagement Quality', value: drep.rationaleRate, weight: '40%' },
    { label: 'Effective Participation', value: drep.effectiveParticipation, weight: '25%' },
    { label: 'Reliability', value: drep.reliabilityScore, weight: '25%' },
    { label: 'Governance Identity', value: drep.profileCompleteness, weight: '10%' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'overflow-y-auto',
          isMobile ? 'max-h-[85vh] rounded-t-2xl' : 'w-full sm:max-w-md',
        )}
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-left">
            <span className="truncate">{displayName}</span>
            {isDelegated && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-primary/40 text-primary shrink-0"
              >
                Your DRep
              </Badge>
            )}
          </SheetTitle>
          {drep.handle && (
            <span className="text-xs text-muted-foreground font-mono">{drep.handle}</span>
          )}
          <SocialIcons metadata={drep.metadata} />
        </SheetHeader>

        <div className="space-y-5">
          {/* Score section */}
          <div className="flex items-center gap-4">
            <ScoreBreakdownTooltip drep={drep}>
              <div className="flex flex-col items-center cursor-help">
                <span className="text-3xl font-bold tabular-nums">{score}</span>
                <Badge
                  variant="outline"
                  className={cn('text-xs font-medium mt-1', getDRepScoreBadgeClass(score))}
                >
                  {score >= 80 ? 'Strong' : score >= 60 ? 'Good' : 'Low'}
                </Badge>
              </div>
            </ScoreBreakdownTooltip>
            <div className="flex-1 space-y-2">
              {pillars.map((p) => (
                <div key={p.label} className="space-y-0.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {p.label} ({p.weight})
                    </span>
                    <span className="tabular-nums">{Math.round(p.value)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${Math.min(100, p.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Size + Power */}
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn('text-xs font-medium', getSizeBadgeClass(drep.sizeTier))}
            >
              {drep.sizeTier}
            </Badge>
            <span className="text-sm text-muted-foreground tabular-nums">
              {formatAda(drep.votingPower)} ADA
            </span>
            <span className="text-xs text-muted-foreground">
              {drep.delegatorCount.toLocaleString()} delegator{drep.delegatorCount !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Governance DNA match section */}
          {matchDetail && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Governance DNA Match</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-sm font-bold tabular-nums',
                    matchDetail.matchScore >= 70
                      ? 'text-green-600 dark:text-green-400 border-green-500/30'
                      : matchDetail.matchScore >= 50
                        ? 'text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'text-muted-foreground',
                  )}
                >
                  {matchDetail.matchScore}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Agreed on {matchDetail.agreed} of {matchDetail.total} proposals
              </p>

              {matchDetail.currentDRepScore != null && (
                <p className="text-xs text-muted-foreground">
                  vs your current DRep:{' '}
                  <span className="font-medium">{matchDetail.currentDRepScore}%</span>
                </p>
              )}

              {matchDetail.comparisons.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {matchDetail.comparisons.slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-start gap-2 text-xs p-1.5 rounded',
                        c.agreed ? 'bg-green-500/5' : 'bg-red-500/5',
                      )}
                    >
                      {c.agreed ? (
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <XIcon className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <span className="text-foreground line-clamp-1">{c.proposalTitle}</span>
                        {!c.agreed && (
                          <span className="text-muted-foreground">
                            You: {c.userVote} | They: {c.drepVote}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trait tags (fallback when no match data) */}
          {!matchDetail && traitTags.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <span className="text-sm font-semibold">This DRep tends to:</span>
              <ul className="space-y-1">
                {traitTags.map((tag) => (
                  <li key={tag} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Link href={`/drep/${encodeURIComponent(drep.drepId)}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                View Full Profile
              </Button>
            </Link>
            {onWatchlistToggle && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => onWatchlistToggle(drep.drepId)}
                aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                <Heart
                  className={cn(
                    'h-4 w-4',
                    isWatchlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground',
                  )}
                />
              </Button>
            )}
          </div>

          <Link href={`/drep/${encodeURIComponent(drep.drepId)}`}>
            <Button className="w-full gap-2">
              <Vote className="h-4 w-4" />
              {isDelegated ? 'View Your DRep' : 'Delegate to this DRep'}
            </Button>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
