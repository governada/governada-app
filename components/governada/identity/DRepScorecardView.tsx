'use client';

import Link from 'next/link';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWorkspaceCockpit } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * DRepScorecardView — Your personal DRep governance scorecard.
 *
 * Shows score breakdown, pillar analysis, tier progress, and improvement actions.
 * Gated to DRep segment — non-DReps see a message.
 */
export function DRepScorecardView() {
  const { segment, drepId } = useSegment();
  const { data, isLoading, error } = useWorkspaceCockpit(drepId);

  if (segment !== 'drep') {
    return (
      <div className="text-center space-y-4 py-12">
        <h1 className="text-2xl font-bold text-foreground">DRep Scorecard</h1>
        <p className="text-muted-foreground">
          This page is available to registered DReps. Register as a DRep to see your governance
          scorecard.
        </p>
        <Button asChild>
          <Link href="/you">Back to Identity</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center space-y-4 py-12">
        <h1 className="text-2xl font-bold text-foreground">DRep Scorecard</h1>
        <p className="text-muted-foreground">
          Unable to load your scorecard. Please try refreshing.
        </p>
      </div>
    );
  }

  const { score } = data;
  const pillars = [
    { label: 'Engagement Quality', value: score.pillars.engagementQuality, weight: '40%' },
    {
      label: 'Effective Participation',
      value: score.pillars.effectiveParticipation,
      weight: '25%',
    },
    { label: 'Reliability', value: score.pillars.reliability, weight: '25%' },
    { label: 'Governance Identity', value: score.pillars.governanceIdentity, weight: '10%' },
  ];

  const TrendIcon = score.trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor = score.trend >= 0 ? 'text-emerald-500' : 'text-rose-500';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">DRep Scorecard</h1>

      {/* Score hero */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">Governance Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums text-foreground">
                {score.current}
              </span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{score.tier}</p>
            {score.trend !== 0 && (
              <div className={`flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-3.5 w-3.5" />
                <span className="text-sm font-medium tabular-nums">
                  {score.trend > 0 ? '+' : ''}
                  {score.trend}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Rank context */}
        <p className="text-sm text-muted-foreground">
          Top {score.percentile}%
          {score.rank != null && ` · Rank ${score.rank} of ${score.totalDReps}`}
        </p>

        {/* Tier progress */}
        {score.tierProgress.pointsToNext != null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{score.tierProgress.currentTier}</span>
              <span>
                {score.tierProgress.pointsToNext} pts to {score.tierProgress.nextTier}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${score.tierProgress.percentWithinTier}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pillar breakdown */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </h2>
        <div className="space-y-3">
          {pillars.map((p) => (
            <div key={p.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">{p.label}</span>
                <span className="tabular-nums font-medium text-foreground">
                  {Math.round(p.value)}{' '}
                  <span className="text-muted-foreground font-normal">({p.weight})</span>
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${p.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended action */}
      {score.tierProgress.recommendedAction && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Recommended Action
          </p>
          <p className="text-sm font-medium text-foreground">
            {score.tierProgress.recommendedAction}
          </p>
        </div>
      )}

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {drepId && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/drep/${encodeURIComponent(drepId)}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Public Profile
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/votes">Voting Record</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/delegators">Delegators</Link>
        </Button>
      </div>
    </div>
  );
}
