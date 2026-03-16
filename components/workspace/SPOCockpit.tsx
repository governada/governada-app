'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Newspaper,
  ArrowRight,
  BarChart3,
  Medal,
  Activity,
  Shield,
  FileText,
} from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSPOPoolCompetitive, useSPOSummary } from '@/hooks/queries';
import { DepthGate } from '@/components/providers/DepthGate';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DepthUpgradeNudge } from '@/components/shared/DepthUpgradeNudge';
import { GovernanceDelegationProof } from './GovernanceDelegationProof';
import {
  type AlignmentScores,
  getPersonalityLabel,
  getDominantDimension,
  getIdentityColor,
} from '@/lib/drepIdentity';
import { computeTier } from '@/lib/scoring/tiers';

// Types for competitive endpoint data
interface NeighborPool {
  poolId: string;
  ticker: string | null;
  poolName: string | null;
  score: number | null;
  rank: number;
  isTarget: boolean;
  tier: string;
}

interface ScoreSnapshot {
  epoch_no: number;
  governance_score: number | null;
}

// Lightweight type for the briefing data we consume
interface SPOBriefingData {
  epoch: number;
  headlines?: { title: string; description: string; type: string }[];
  treasury: {
    balanceAda: number;
    trend: string;
  };
}

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
 * - Deep:      + pool comparison analytics (rank, peers, score trend)
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

  // Deep analytics data from competitive endpoint
  const neighbors = (competitive?.neighbors as NeighborPool[]) ?? [];
  const scoreHistory = (competitive?.scoreHistory as ScoreSnapshot[]) ?? [];

  // Identity badge: personality from alignment data, fallback to tier
  const alignment = (summary as Record<string, unknown> | undefined)?.alignment as
    | AlignmentScores
    | undefined;
  const hasAlignment =
    alignment != null &&
    (alignment.treasuryConservative != null ||
      alignment.treasuryGrowth != null ||
      alignment.decentralization != null ||
      alignment.security != null ||
      alignment.innovation != null ||
      alignment.transparency != null);
  const personalityLabel = hasAlignment ? getPersonalityLabel(alignment!) : null;
  const identityColor = hasAlignment ? getIdentityColor(getDominantDimension(alignment!)) : null;
  const tier =
    (pool?.tier as string) ??
    ((summary as Record<string, unknown> | undefined)?.tier as string | undefined) ??
    (score > 0 ? computeTier(score) : null);

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

        {/* Identity badge — all depths (governance personality or tier) */}
        {(personalityLabel || tier) && (
          <div className="flex items-center gap-1.5">
            <Shield
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: identityColor?.hex ?? 'currentColor' }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: identityColor?.hex ?? undefined }}
            >
              {personalityLabel ?? tier}
            </span>
            {personalityLabel && tier && (
              <span className="text-xs text-muted-foreground">&middot; {tier}</span>
            )}
          </div>
        )}

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
                {liveStakeAda > 0 ? `₳${formatAdaCompact(liveStakeAda)}` : 'Syncing...'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Voting Power</p>
            </div>
          </div>
        </DepthGate>
      </div>

      {/* Review Proposals — primary action CTA */}
      <Link
        href="/governance/proposals"
        className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 hover:bg-primary/10 transition-colors group"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Review Proposals</p>
          <p className="text-xs text-muted-foreground">
            Review active governance proposals and cast your vote
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </Link>

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

      {/* Deep: Pool comparison analytics */}
      <DepthGate minDepth="deep">
        <PoolComparisonAnalytics
          score={score}
          rank={rank}
          totalPools={totalPools}
          percentile={percentile}
          participationRate={participationRate}
          neighbors={neighbors}
          scoreHistory={scoreHistory}
        />
      </DepthGate>

      {/* Governance This Epoch — informed+ (citizen governance intelligence for SPOs) */}
      <DepthGate minDepth="informed">
        <GovernanceThisEpoch />
      </DepthGate>

      {/* Depth upgrade nudge — shows when user could see more at a higher depth */}
      <DepthUpgradeNudge feature="governance analytics" requiredDepth="engaged" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool Comparison Analytics — deep-depth competitive intelligence
// ---------------------------------------------------------------------------

interface PoolComparisonAnalyticsProps {
  score: number;
  rank: number;
  totalPools: number;
  percentile: number;
  participationRate: number;
  neighbors: NeighborPool[];
  scoreHistory: ScoreSnapshot[];
}

function PoolComparisonAnalytics({
  score,
  rank,
  totalPools,
  percentile,
  participationRate,
  neighbors,
  scoreHistory,
}: PoolComparisonAnalyticsProps) {
  // Compute median score of neighboring pools (excluding the target pool)
  const peerScores = neighbors
    .filter((n) => !n.isTarget && n.score != null)
    .map((n) => n.score as number);
  const medianPeerScore =
    peerScores.length > 0
      ? Math.round(peerScores.sort((a, b) => a - b)[Math.floor(peerScores.length / 2)])
      : null;

  // Score trend from recent history
  const recentHistory = scoreHistory.slice(0, 5);
  const oldestScore =
    recentHistory.length >= 2
      ? (recentHistory[recentHistory.length - 1].governance_score ?? 0)
      : null;
  const latestScore = recentHistory.length >= 2 ? (recentHistory[0].governance_score ?? 0) : null;
  const scoreTrend =
    oldestScore != null && latestScore != null ? Math.round(latestScore - oldestScore) : null;
  const epochSpan =
    recentHistory.length >= 2
      ? recentHistory[0].epoch_no - recentHistory[recentHistory.length - 1].epoch_no
      : 0;

  // Participation percentile (rough: top X% based on rank position)
  const participationPercentile =
    totalPools > 0 ? Math.max(1, Math.round((1 - rank / totalPools) * 100)) : 0;

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5 space-y-4"
      data-discovery="ws-spo-pool-analytics"
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Pool Analytics</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Governance Rank */}
        <div className="rounded-xl bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Medal className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Governance Rank</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">
            #{rank}{' '}
            <span className="text-sm font-normal text-muted-foreground">of {totalPools}</span>
          </p>
          <p className="text-xs text-muted-foreground">Top {percentile}% of voting pools</p>
        </div>

        {/* Participation Standing */}
        <div className="rounded-xl bg-muted/50 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Participation</p>
          </div>
          <p className="text-lg font-bold tabular-nums text-foreground">{participationRate}%</p>
          <p className="text-xs text-muted-foreground">Top {participationPercentile}% of pools</p>
        </div>
      </div>

      {/* Score trend over recent epochs */}
      {scoreTrend != null && epochSpan > 0 && (
        <div className="rounded-xl bg-muted/50 p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">
              Score Trend ({epochSpan} epoch{epochSpan !== 1 ? 's' : ''})
            </p>
            <p className="text-sm text-foreground">
              {oldestScore} &rarr; {latestScore}
            </p>
          </div>
          <span
            className={`text-sm font-bold tabular-nums ${
              scoreTrend > 0
                ? 'text-emerald-400'
                : scoreTrend < 0
                  ? 'text-amber-400'
                  : 'text-muted-foreground'
            }`}
          >
            {scoreTrend > 0 ? '+' : ''}
            {scoreTrend}
          </span>
        </div>
      )}

      {/* Score vs Peers */}
      {medianPeerScore != null && (
        <div className="rounded-xl bg-muted/50 p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">Score vs Nearby Peers</p>
            <p className="text-sm text-foreground">
              Your score: {score} &middot; Peer median: {medianPeerScore}
            </p>
          </div>
          <span
            className={`text-sm font-bold tabular-nums ${
              score > medianPeerScore
                ? 'text-emerald-400'
                : score < medianPeerScore
                  ? 'text-amber-400'
                  : 'text-muted-foreground'
            }`}
          >
            {score > medianPeerScore ? '+' : ''}
            {score - medianPeerScore}
          </span>
        </div>
      )}

      {/* Nearby competitor leaderboard */}
      {neighbors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Nearby Competitors
          </p>
          <div className="space-y-1">
            {neighbors.map((n) => (
              <div
                key={n.poolId}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  n.isTarget ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">
                    #{n.rank}
                  </span>
                  <span
                    className={`truncate ${n.isTarget ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                  >
                    {n.ticker ?? n.poolName ?? n.poolId.slice(0, 8)}
                    {n.isTarget && ' (you)'}
                  </span>
                </div>
                <span className="text-xs font-medium tabular-nums text-foreground shrink-0 ml-2">
                  {Math.round(n.score ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Governance This Epoch — condensed citizen briefing for SPOs
// ---------------------------------------------------------------------------

function GovernanceThisEpoch() {
  const { data: briefing, isLoading } = useQuery<SPOBriefingData>({
    queryKey: ['citizen-briefing-spo'],
    queryFn: async () => {
      const res = await fetch('/api/briefing/citizen');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!briefing) return null;

  const headlines = (briefing.headlines ?? []).slice(0, 3);
  const treasuryAda = briefing.treasury?.balanceAda ?? 0;

  // Compute approximate runway in years (treasury / ~73M ADA annual burn estimate)
  const ANNUAL_BURN_ESTIMATE = 73_000_000;
  const runwayYears = treasuryAda > 0 ? Math.round(treasuryAda / ANNUAL_BURN_ESTIMATE) : null;

  // Nothing to show
  if (headlines.length === 0 && treasuryAda === 0) return null;

  return (
    <div
      className="rounded-2xl border border-border bg-card p-5 space-y-3"
      data-discovery="ws-spo-epoch-briefing"
    >
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Governance This Epoch</h2>
      </div>

      {headlines.length > 0 && (
        <ul className="space-y-1">
          {headlines.map((h, i) => (
            <li key={i} className="text-sm text-muted-foreground truncate">
              <span className="text-primary font-bold mr-1.5">&bull;</span>
              {h.title}
            </li>
          ))}
        </ul>
      )}

      {treasuryAda > 0 && (
        <p className="text-xs text-muted-foreground">
          Treasury: ₳{formatAdaCompact(treasuryAda)}
          {runwayYears != null && runwayYears > 0 && ` (~${runwayYears} year runway)`}
        </p>
      )}

      <Link
        href="/governance/health"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View full briefing
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
