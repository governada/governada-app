'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Server, Shield, ChevronRight, Zap, Vote } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MatchResult } from '@/hooks/useQuickMatch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolMatchEnhancementProps {
  /** SPO match results from the quick-match quiz */
  spoMatches: MatchResult[];
  /** Whether the DRep tab is currently active */
  isDRepTabActive: boolean;
}

// ---------------------------------------------------------------------------
// Governance action types SPOs vote on
// ---------------------------------------------------------------------------

const SPO_GOVERNANCE_AREAS = [
  'hard forks',
  'protocol parameter changes',
  'network security',
] as const;

function getGovernanceCoverage(match: MatchResult): string {
  // Derive governance focus from alignment dimensions
  const areas: string[] = [];
  if (match.agreeDimensions.some((d) => /security|protocol/i.test(d))) {
    areas.push('hard forks');
  }
  if (match.agreeDimensions.some((d) => /innovation|treasury/i.test(d))) {
    areas.push('parameter changes');
  }
  if (areas.length === 0) {
    // Default: SPOs always vote on hard forks and parameter changes
    return 'hard forks, parameter changes';
  }
  return areas.join(', ');
}

function getParticipationLabel(match: MatchResult): string | null {
  if (match.voteCount && match.voteCount > 0) {
    return `${match.voteCount} governance vote${match.voteCount !== 1 ? 's' : ''}`;
  }
  if (match.participationPct && match.participationPct > 0) {
    return `${match.participationPct}% participation`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pool Card
// ---------------------------------------------------------------------------

function PoolCard({ match }: { match: MatchResult }) {
  const displayName = match.drepName || `${match.drepId.slice(0, 9)}...${match.drepId.slice(-4)}`;
  const profilePath = `/pool/${encodeURIComponent(match.drepId)}`;
  const participationLabel = getParticipationLabel(match);
  const governanceCoverage = getGovernanceCoverage(match);

  return (
    <Card className="overflow-hidden hover:border-amber-500/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Server className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={profilePath}
                  className="font-semibold text-sm hover:text-primary transition-colors truncate block"
                >
                  {displayName}
                </Link>
                <span className="text-xs text-muted-foreground">Gov Score: {match.drepScore}</span>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 tabular-nums text-xs font-bold',
                  match.matchScore >= 70
                    ? 'text-green-600 border-green-600/30 bg-green-500/5'
                    : match.matchScore >= 50
                      ? 'text-amber-600 border-amber-600/30 bg-amber-500/5'
                      : 'text-muted-foreground',
                )}
              >
                {match.matchScore}% match
              </Badge>
            </div>

            {/* Activity signals */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {participationLabel && (
                <span className="flex items-center gap-1">
                  <Vote className="h-3 w-3" />
                  {participationLabel}
                </span>
              )}
              {match.delegatorCount != null && match.delegatorCount > 0 && (
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {match.delegatorCount.toLocaleString()} delegators
                </span>
              )}
            </div>

            {/* Governance coverage */}
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">Covers:</span> {governanceCoverage}
            </p>

            {/* CTA */}
            <div className="flex gap-2 pt-0.5">
              <Link href={profilePath}>
                <Button variant="outline" size="sm" className="text-xs gap-1 h-7">
                  Learn More <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PoolMatchEnhancement({ spoMatches, isDRepTabActive }: PoolMatchEnhancementProps) {
  // Only show when DRep tab is active (to complement DRep results)
  // and there are SPO matches to recommend
  const topPools = useMemo(() => {
    if (!spoMatches || spoMatches.length === 0) return [];
    // Take top 3 governance-active pools
    return spoMatches.filter((m) => m.matchScore > 0).slice(0, 3);
  }, [spoMatches]);

  // Don't render if no pools or not on DRep tab
  if (!isDRepTabActive || topPools.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2 justify-center">
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-1.5 shrink-0">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400 tracking-wide uppercase">
            Complete Your Governance Team
          </p>
        </div>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">
        Your DRep votes on proposals, but SPOs also vote on hard forks and protocol changes. These
        governance-active pools align with your values.
      </p>

      {/* Pool cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topPools.map((match) => (
          <PoolCard key={match.drepId} match={match} />
        ))}
      </div>

      {/* Browse all link */}
      <div className="text-center">
        <Link
          href="/governance/pools"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          Browse all governance-active pools
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
