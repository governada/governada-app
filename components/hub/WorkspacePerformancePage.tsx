'use client';

import Link from 'next/link';
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDRepReportCard, useDashboardCompetitive } from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

interface ScorePillar {
  label: string;
  value: number;
  max: number;
}

/**
 * WorkspacePerformancePage — DRep score breakdown + competitive position.
 *
 * JTBD: "How can I improve my score and ranking?"
 * Score with pillar breakdown, competitive context.
 */
export function WorkspacePerformancePage() {
  const { segment, drepId } = useSegment();
  const { data: reportRaw, isLoading: rcLoading } = useDRepReportCard(drepId);
  const { data: compRaw, isLoading: compLoading } = useDashboardCompetitive(drepId);

  if (segment !== 'drep') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">This page is for DReps.</p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  const isLoading = rcLoading || compLoading;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          <Skeleton className="h-6 w-32" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const report = reportRaw as Record<string, unknown> | undefined;
  const competitive = compRaw as Record<string, unknown> | undefined;

  const score = Math.round((report?.score as number) ?? 0);
  const tier = (report?.tier as string) ?? computeTier(score);
  const trend = (report?.trend as number) ?? 0;
  const rank = (competitive?.rank as number) ?? 0;
  const totalDReps = (competitive?.totalDReps as number) ?? 0;
  const percentile = Math.round((competitive?.percentile as number) ?? 0);

  // Build pillar breakdown from report card
  const pillars: ScorePillar[] = [];
  const participation = (report?.participationRate as number) ?? 0;
  const rationaleRate = (report?.rationaleRate as number) ?? 0;
  const reliability = (report?.reliabilityScore as number) ?? (report?.reliability as number) ?? 0;
  const profileCompleteness = (report?.profileCompleteness as number) ?? 0;

  pillars.push({ label: 'Participation', value: Math.round(participation), max: 100 });
  pillars.push({ label: 'Rationale Rate', value: Math.round(rationaleRate), max: 100 });
  pillars.push({ label: 'Reliability', value: Math.round(reliability * 100), max: 100 });
  pillars.push({ label: 'Profile', value: Math.round(profileCompleteness * 100), max: 100 });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Performance</h1>
      </div>

      {/* Score hero */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {tier} Tier
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Rank {rank} of {totalDReps} &middot; Top {percentile}%
            </p>
          </div>
          <div className="text-right">
            <span className="text-4xl font-bold tabular-nums text-foreground">{score}</span>
            <div className="flex items-center justify-end gap-1 text-sm">
              <TrendIcon value={trend} />
              <span className="tabular-nums">
                {trend >= 0 ? '+' : ''}
                {trend.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pillar breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Score Breakdown
        </h3>
        {pillars.map((p) => (
          <div key={p.label} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{p.label}</span>
              <span className="text-sm font-bold tabular-nums text-foreground">{p.value}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (p.value / p.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* View full profile */}
      {drepId && (
        <Button asChild variant="outline" className="w-full">
          <Link href={`/drep/${encodeURIComponent(drepId)}`}>View Public Profile</Link>
        </Button>
      )}
    </div>
  );
}
