'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSPOPoolCompetitive, useSPOSummary } from '@/hooks/queries';
import { DepthGate } from '@/components/providers/DepthGate';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GovernanceDelegationProof } from './GovernanceDelegationProof';

function formatAdaCompact(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

/**
 * SPO Governance Cockpit — leads with delegation intelligence,
 * governance score as supporting context.
 *
 * Depth-adaptive layout:
 * - Hands-Off: Delegation hero + governance score (status widget)
 * - Informed:  + delegator count + vote/participation stats (operational summary)
 * - Engaged:   Current full cockpit (default for SPOs)
 * - Deep:      + pool comparison analytics placeholder
 *
 * SPO default depth = engaged, so existing users see no change.
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

  // Delegation data from summary API
  const delegatorCount = (summary?.delegatorCount as number) ?? 0;
  const liveStakeAda = (summary?.liveStakeAda as number) ?? 0;
  const scoreDelta = (summary?.scoreDelta as number) ?? null;
  const momentum = (summary?.momentum as string) ?? (competitive?.momentum as string) ?? null;

  // Determine delegation growth framing
  const isGrowing = momentum === 'rising' || (scoreDelta != null && scoreDelta > 0);
  const isShrinking = momentum === 'falling' || (scoreDelta != null && scoreDelta < 0);

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
      {/* Delegation hero — all depths (this is what SPOs care about most) */}
      <div
        className={`rounded-2xl border p-5 space-y-3 ${
          isGrowing
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : isShrinking
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-border bg-card'
        }`}
        data-discovery="ws-spo-delegation"
      >
        {/* Headline: stake + growth framing */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Delegation</h2>
            {isGrowing ? (
              <p className="text-sm text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Delegation growing &mdash; governance participation may be helping
              </p>
            ) : isShrinking ? (
              <p className="text-sm text-amber-400 flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                Delegation trending down &mdash; stay active on proposals to improve visibility
              </p>
            ) : (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Minus className="h-3.5 w-3.5" />
                Delegation stable
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <span className="text-3xl font-bold tabular-nums text-foreground">
              {liveStakeAda > 0
                ? `₳${formatAdaCompact(liveStakeAda)}`
                : delegatorCount.toLocaleString()}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {liveStakeAda > 0 ? 'live stake' : 'delegators'}
            </p>
          </div>
        </div>

        {/* Delegation metrics — informed+ (operational detail) */}
        <DepthGate minDepth="informed">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-foreground">
                {delegatorCount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Delegators</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-xl font-bold tabular-nums text-foreground">
                {liveStakeAda > 0 ? `₳${formatAdaCompact(liveStakeAda)}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Voting Power</p>
            </div>
          </div>
        </DepthGate>
      </div>

      {/* Score overview — all depths (governance score as supporting context) */}
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

        {/* Vote/participation stats — informed+ (operational summary) */}
        <DepthGate minDepth="informed">
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
        </DepthGate>
      </div>

      {/* Governance-drives-delegation proof — informed+ */}
      <DepthGate minDepth="informed">
        <GovernanceDelegationProof participationRate={participationRate} governanceScore={score} />
      </DepthGate>

      {/* Improvement suggestions — engaged+ (full cockpit experience) */}
      <DepthGate minDepth="engaged">
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
      </DepthGate>

      {/* Quick links — engaged+ (workspace navigation) */}
      <DepthGate minDepth="engaged">
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
      </DepthGate>

      {/* Deep: placeholder for pool comparison analytics */}
      <DepthGate minDepth="deep">
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Pool Comparison Analytics</p>
          <p className="text-xs text-muted-foreground/70">
            Compare your governance activity against similar pools — coming soon.
          </p>
        </div>
      </DepthGate>
    </div>
  );
}
