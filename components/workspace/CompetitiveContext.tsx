'use client';

import Link from 'next/link';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDashboardCompetitive, useWorkspaceCockpit } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * CompetitiveContext — shows DReps their rank, percentile, and peer comparison.
 *
 * "You rank #X out of Y active DReps"
 * "Your participation rate is above X% of DReps"
 */
export function CompetitiveContext() {
  const { drepId } = useSegment();
  const { data: cockpit, isLoading: cockpitLoading } = useWorkspaceCockpit(drepId);
  const { data: compRaw, isLoading: compLoading } = useDashboardCompetitive(drepId);

  const isLoading = cockpitLoading || compLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  const competitive = compRaw as Record<string, unknown> | undefined;
  const rank = cockpit?.score?.rank ?? (competitive?.rank as number) ?? null;
  const totalDReps = cockpit?.score?.totalDReps ?? (competitive?.totalDReps as number) ?? 0;
  const percentile =
    cockpit?.score?.percentile ?? Math.round((competitive?.percentile as number) ?? 0);
  const score = cockpit?.score?.current ?? 0;
  const trend = cockpit?.score?.trend ?? 0;

  if (!rank && !percentile) return null;

  return (
    <div className="space-y-3" data-discovery="drep-competitive">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Competitive Position
        </h3>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {rank != null && (
              <p className="text-2xl font-bold tabular-nums text-foreground">
                #{rank}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">
                  of {totalDReps} active DReps
                </span>
              </p>
            )}
            <p className="text-sm text-muted-foreground">Top {percentile}% overall</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-3xl font-bold tabular-nums text-foreground">{score}</span>
            {trend !== 0 && (
              <span
                className={`flex items-center gap-1 text-xs font-medium tabular-nums ${
                  trend > 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {trend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend > 0 ? '+' : ''}
                {trend.toFixed(1)}
              </span>
            )}
            {trend === 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" /> Stable
              </span>
            )}
          </div>
        </div>

        {/* Comparative metrics */}
        {cockpit?.score?.pillars && (
          <div className="grid grid-cols-2 gap-2">
            <MetricCompare
              label="Participation"
              value={Math.round(cockpit.score.pillars.effectiveParticipation)}
              suffix="%"
            />
            <MetricCompare
              label="Engagement"
              value={Math.round(cockpit.score.pillars.engagementQuality)}
              suffix="%"
            />
            <MetricCompare
              label="Reliability"
              value={Math.round(cockpit.score.pillars.reliability)}
              suffix="%"
            />
            <MetricCompare
              label="Identity"
              value={Math.round(cockpit.score.pillars.governanceIdentity)}
              suffix="%"
            />
          </div>
        )}

        <Button asChild variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
          <Link href="/governance/leaderboard">
            See full leaderboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function MetricCompare({
  label,
  value,
  suffix = '',
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">
        {value}
        {suffix}
      </p>
    </div>
  );
}
