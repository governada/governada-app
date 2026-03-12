'use client';

import Link from 'next/link';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSPOPoolCompetitive, useSPOSummary } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * SPO Governance Cockpit — Governance score overview for SPOs.
 *
 * JTBD: "What's my governance reputation?"
 * Score with pillar breakdown, top improvement suggestions, trend.
 */
export function SPOCockpit() {
  const { poolId } = useSegment();
  const { data: competitiveRaw, isLoading: compLoading } = useSPOPoolCompetitive(poolId);
  const { data: summaryRaw, isLoading: sumLoading } = useSPOSummary(poolId);

  const isLoading = compLoading || sumLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const competitive = competitiveRaw as Record<string, unknown> | undefined;
  const summary = summaryRaw as Record<string, unknown> | undefined;
  const pool = competitive?.pool as Record<string, unknown> | undefined;
  const score = Math.round((pool?.governance_score as number) ?? 0);
  const rank = (competitive?.rank as number) ?? 0;
  const totalPools = (competitive?.totalPools as number) ?? 0;
  const percentile = Math.round((competitive?.percentile as number) ?? 0);
  const voteCount = (summary?.voteCount as number) ?? (pool?.vote_count as number) ?? 0;
  const participationRate = Math.round((summary?.participationRate as number) ?? 0);

  // Improvement suggestions based on score components
  const suggestions: string[] = [];
  if (voteCount === 0)
    suggestions.push('Cast your first governance vote to appear on the leaderboard');
  if (participationRate < 50)
    suggestions.push('Vote on more proposals to improve participation rate');
  if (score < 50) suggestions.push('Add a governance statement to your pool profile');
  if (suggestions.length === 0) suggestions.push('Keep voting consistently to maintain your rank');

  return (
    <div className="space-y-6" data-discovery="spo-score">
      {/* Score overview */}
      <div
        className="rounded-2xl border border-border bg-card p-5 space-y-4"
        data-discovery="ws-spo-score"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Governance Score</h2>
            <p className="text-sm text-muted-foreground">
              Rank {rank} of {totalPools} pools &middot; Top {percentile}%
            </p>
          </div>
          <span className="text-4xl font-bold tabular-nums text-foreground">{score}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{voteCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Votes Cast</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{participationRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
          </div>
        </div>
      </div>

      {/* Improvement suggestions */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Next Steps
        </h3>
        {suggestions.slice(0, 3).map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-border bg-card p-3"
          >
            <span className="text-primary font-bold text-sm">{i + 1}.</span>
            <p className="text-sm text-foreground">{s}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/pool-profile">Pool Profile</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/position">Competitive Position</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/delegators">Delegators</Link>
        </Button>
      </div>
    </div>
  );
}
