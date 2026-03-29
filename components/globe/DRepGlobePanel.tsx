'use client';

/**
 * DRepGlobePanel — DRep detail for the globe panel overlay.
 *
 * Enhanced version of DRepPeek with richer data display.
 * Links to related entities navigate within /g/ (keeping globe context).
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, Vote, ExternalLink, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useDReps, useDRepVotes } from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';
import type { EnrichedDRep } from '@/lib/koios';
import type { VotesResponseData, VoteItem } from '@/types/api';
import { PillarBar, VOTE_COLOR } from './panelShared';

interface DRepGlobePanelProps {
  drepId: string;
}

export function DRepGlobePanel({ drepId }: DRepGlobePanelProps) {
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
    return votes.slice(0, 5);
  }, [votesRaw]);

  if (isLoading || !drep) {
    return <PanelSkeleton />;
  }

  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 16)}...`;

  return (
    <div className="space-y-5">
      {/* Header: Name + score */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Delegated Representative
        </p>
        <h3 className="text-lg font-semibold leading-snug">{displayName}</h3>
        <div className="flex items-center gap-2">
          <span className={cn('text-3xl font-bold tabular-nums', TIER_SCORE_COLOR[tier])}>
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
        <StatBox
          icon={Users}
          value={(drep.delegatorCount ?? 0).toLocaleString()}
          label="Delegators"
        />
        <StatBox icon={Vote} value={String(drep.totalVotes ?? 0)} label="Votes" />
      </div>

      {/* Voting power */}
      {drep.votingPower != null && drep.votingPower > 0 && (
        <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-center">
          <span className="text-xs text-muted-foreground">Voting Power</span>
          <span className="text-lg font-bold tabular-nums block">
            {'\u20B3'}
            {formatAda(drep.votingPower)}
          </span>
        </div>
      )}

      {/* Score breakdown */}
      <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/10 p-3">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </span>
        <PillarBar label="Engagement" value={drep.engagementQuality} />
        <PillarBar label="Participation" value={drep.effectiveParticipationV3} />
        <PillarBar label="Reliability" value={drep.reliabilityV3} />
        <PillarBar label="Identity" value={drep.governanceIdentity} />
      </div>

      {/* Recent votes — with globe navigation links */}
      {recentVotes.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Votes
          </span>
          {recentVotes.map((v, i) => {
            const vote = v.vote ?? v.voteDirection ?? '';
            const title = v.proposalTitle || `Proposal ${v.proposalTxHash?.slice(0, 12)}...`;
            const proposalLink =
              v.proposalTxHash != null
                ? `/proposal/${v.proposalTxHash}/${v.proposalIndex ?? 0}`
                : null;
            return (
              <div key={i} className="flex items-center gap-2 text-xs group">
                <span
                  className={cn(
                    'font-semibold shrink-0 w-12',
                    VOTE_COLOR[vote] ?? 'text-muted-foreground',
                  )}
                >
                  {vote || '—'}
                </span>
                {proposalLink ? (
                  <Link
                    href={proposalLink}
                    className="truncate text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {title}
                    <ArrowRight className="inline h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ) : (
                  <span className="truncate text-muted-foreground">{title}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Open full profile link (existing detail page) */}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatBox({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 text-center">
      <Icon className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] text-muted-foreground block">{label}</span>
    </div>
  );
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

function PanelSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
