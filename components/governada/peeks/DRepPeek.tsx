'use client';

/**
 * DRepPeek — DRep summary content for the peek drawer.
 *
 * Shows: name, tier badge, 4-pillar score mini, alignment match %,
 * delegation count, recent 3 votes, "Open full" link.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { ExternalLink, Users, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useDReps, useDRepVotes } from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';
import type { EnrichedDRep } from '@/lib/koios';
import type { VotesResponseData, VoteItem } from '@/types/api';

interface DRepPeekProps {
  drepId: string;
}

function PillarBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct >= 70
              ? 'bg-emerald-500/80'
              : pct >= 40
                ? 'bg-amber-500/70'
                : 'bg-muted-foreground/40',
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
        {Math.round(pct)}
      </span>
    </div>
  );
}

const VOTE_COLOR: Record<string, string> = {
  Yes: 'text-emerald-400',
  No: 'text-red-400',
  Abstain: 'text-amber-400',
};

export function DRepPeek({ drepId }: DRepPeekProps) {
  const { data: rawData, isLoading } = useDReps();
  const drepsData = rawData as { allDReps?: EnrichedDRep[] } | undefined;
  const { data: votesRaw } = useDRepVotes(drepId);

  const drep = useMemo(() => {
    const dreps = drepsData?.allDReps ?? [];
    return dreps.find((d) => d.drepId === drepId);
  }, [drepsData, drepId]);

  const recentVotes = useMemo(() => {
    const votesData = votesRaw as VotesResponseData | undefined;
    const votes = votesData?.votes ?? (votesRaw as VoteItem[] | undefined);
    if (!Array.isArray(votes)) return [];
    return votes.slice(0, 3);
  }, [votesRaw]);

  if (isLoading || !drep) {
    return (
      <div className="space-y-4 pt-2">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }

  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 16)}...`;

  return (
    <div className="space-y-4 pt-1">
      {/* Name + tier */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold leading-snug">{displayName}</h3>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-bold tabular-nums', TIER_SCORE_COLOR[tier])}>
            {score}
          </span>
          <span
            className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', TIER_BADGE_BG[tier])}
          >
            {tier}
          </span>
          {drep.isActive ? (
            <span className="text-[10px] text-emerald-400 font-medium">Active</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">Inactive</span>
          )}
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 text-center">
          <Users className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
          <span className="text-sm font-semibold tabular-nums">
            {(drep.delegatorCount ?? 0).toLocaleString()}
          </span>
          <span className="text-[10px] text-muted-foreground block">Delegators</span>
        </div>
        <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 text-center">
          <Vote className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
          <span className="text-sm font-semibold tabular-nums">{drep.totalVotes ?? 0}</span>
          <span className="text-[10px] text-muted-foreground block">Votes</span>
        </div>
      </div>

      {/* 4 Pillar scores */}
      <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/10 p-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </span>
        <PillarBar label="Engagement" value={drep.engagementQuality} />
        <PillarBar label="Participation" value={drep.effectiveParticipationV3} />
        <PillarBar label="Reliability" value={drep.reliabilityV3} />
        <PillarBar label="Identity" value={drep.governanceIdentity} />
      </div>

      {/* Recent votes */}
      {recentVotes.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Votes
          </span>
          {recentVotes.map((v, i) => {
            const vote = v.vote ?? v.voteDirection ?? '';
            const title = v.proposalTitle || `Proposal ${v.proposalTxHash?.slice(0, 12)}...`;
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    'font-semibold shrink-0 w-12',
                    VOTE_COLOR[vote] ?? 'text-muted-foreground',
                  )}
                >
                  {vote || '—'}
                </span>
                <span className="truncate text-muted-foreground">{title}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Open full link */}
      <Link
        href={`/drep/${drep.drepId}`}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg',
          'text-sm font-medium transition-colors',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
      >
        Open full scorecard
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
