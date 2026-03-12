'use client';

import Link from 'next/link';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSPOPoolCompetitive, useSPOSummary } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink } from 'lucide-react';

/**
 * SPOScorecardView — Your personal pool governance scorecard.
 *
 * Shows governance score, competitive position, and improvement suggestions.
 * Gated to SPO segment — non-SPOs see a message.
 */
export function SPOScorecardView() {
  const { segment, poolId } = useSegment();
  const { data: competitiveRaw, isLoading: compLoading } = useSPOPoolCompetitive(poolId);
  const { data: summaryRaw, isLoading: sumLoading } = useSPOSummary(poolId);

  const isLoading = compLoading || sumLoading;

  if (segment !== 'spo') {
    return (
      <div className="text-center space-y-4 py-12">
        <h1 className="text-2xl font-bold text-foreground">Pool Scorecard</h1>
        <p className="text-muted-foreground">
          This page is available to stake pool operators. Register a pool to see your governance
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
  const delegatorCount = (pool?.delegator_count as number) ?? 0;

  // Improvement suggestions
  const suggestions: string[] = [];
  if (voteCount === 0)
    suggestions.push('Cast your first governance vote to appear on the leaderboard');
  if (participationRate < 50)
    suggestions.push('Vote on more proposals to improve participation rate');
  if (score < 50) suggestions.push('Add a governance statement to your pool profile');
  if (suggestions.length === 0) suggestions.push('Keep voting consistently to maintain your rank');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground">Pool Scorecard</h1>

      {/* Score hero */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">Governance Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold tabular-nums text-foreground">{score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm text-muted-foreground">
              Rank {rank} of {totalPools}
            </p>
            <p className="text-sm font-medium text-foreground">Top {percentile}%</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{voteCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Votes Cast</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">{participationRate}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground">
              {delegatorCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Delegators</p>
          </div>
        </div>
      </div>

      {/* Improvement suggestions */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Next Steps
        </h2>
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

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {poolId && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/pool/${encodeURIComponent(poolId)}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Public Profile
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/pool-profile">Pool Profile</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/delegators">Delegators</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/workspace/position">Competitive Position</Link>
        </Button>
      </div>
    </div>
  );
}
