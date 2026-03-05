'use client';

import Link from 'next/link';
import {
  Vote,
  Users,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useSPOSummary,
  useSPOVotesHistory,
  useSPOPoolCompetitive,
  useGovernancePulse,
  useSPODelegatorTrends,
} from '@/hooks/queries';
import {
  tierKey,
  TIER_SCORE_COLOR,
  TIER_BADGE_BG,
  TIER_BORDER,
  TIER_BG,
} from '@/components/civica/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';
import { generateActions } from '@/lib/actionFeed';
import { ActionFeed } from './ActionFeed';
import { SPOClaimHero } from './SPOClaimHero';

function ScoreGauge({ score, tier }: { score: number; tier: string }) {
  const tKey = tierKey(tier);
  return (
    <div className={cn('rounded-xl border p-5 space-y-3', TIER_BORDER[tKey], TIER_BG[tKey])}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
        SPO Governance Score
      </p>
      <p
        className={cn(
          'font-display text-5xl font-bold tabular-nums leading-none',
          TIER_SCORE_COLOR[tKey],
        )}
      >
        {score.toFixed(1)}
      </p>
      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all bg-current"
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span
        className={cn(
          'inline-block text-xs font-bold px-2.5 py-0.5 rounded-full',
          TIER_BADGE_BG[tKey],
          TIER_SCORE_COLOR[tKey],
        )}
      >
        {tKey}
      </span>
    </div>
  );
}

export function SPOCommandCenter({ poolId }: { poolId: string }) {
  const { data: rawSummary, isLoading: summaryLoading } = useSPOSummary(poolId);
  const { data: rawVotes, isLoading: votesLoading } = useSPOVotesHistory(poolId);
  const { data: rawCompetitive } = useSPOPoolCompetitive(poolId);
  const { data: rawPulse, isLoading: pulseLoading } = useGovernancePulse();
  const { data: rawDelegatorTrends } = useSPODelegatorTrends(poolId);

  const summary = rawSummary as any;
  const pulse = rawPulse as any;
  const competitive = rawCompetitive as any;
  const delegatorTrends = rawDelegatorTrends as any;
  const votes: any[] = (rawVotes as any)?.votes ?? rawVotes ?? [];
  const allVotes = Array.isArray(votes) ? votes : [];

  const spoScore: number = summary?.spoScore ?? summary?.score ?? 0;
  const spoTier: string = computeTier(spoScore) ?? 'Emerging';
  const isClaimed: boolean = summary?.isClaimed ?? summary?.claimed ?? false;
  const poolName: string = summary?.name ?? summary?.ticker ?? poolId;
  const delegatorCount: number = summary?.delegatorCount ?? delegatorTrends?.current ?? 0;
  const scoreDelta: number | undefined = summary?.scoreDelta ?? summary?.weeklyDelta;
  const participationRate: number = summary?.participationRate ?? 0;
  const rationaleRate: number = summary?.rationaleRate ?? 0;
  const voteCount: number = summary?.voteCount ?? allVotes.length;

  const activeProposals: number = pulse?.activeProposals ?? 0;
  const criticalProposals: number = pulse?.criticalProposals ?? 0;

  const recentVotes = allVotes.slice(0, 5);

  if (!summaryLoading && !isClaimed) {
    return <SPOClaimHero poolId={poolId} poolName={poolName} summary={summary} />;
  }

  const actions = generateActions({
    segment: 'spo',
    activeProposals,
    criticalProposals,
    pendingVotesCount: activeProposals,
    spoScore,
    spoScoreDelta: scoreDelta,
    spoVoteCount: voteCount,
    spoIsClaimed: isClaimed,
  });

  const DeltaIcon =
    scoreDelta == null
      ? Minus
      : scoreDelta > 0
        ? TrendingUp
        : scoreDelta < 0
          ? TrendingDown
          : Minus;
  const deltaColor =
    scoreDelta == null
      ? 'text-muted-foreground'
      : scoreDelta > 0
        ? 'text-emerald-400'
        : 'text-rose-400';

  const rank = competitive?.rank;
  const nearbyPools: any[] = competitive?.nearby ?? [];

  return (
    <div className="space-y-6">
      {/* Score hero */}
      {summaryLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-5 w-16" />
        </div>
      ) : (
        <div className="relative">
          <ScoreGauge score={spoScore} tier={spoTier} />
          {scoreDelta != null && (
            <div
              className={cn(
                'absolute top-5 right-5 flex items-center gap-1 text-sm font-medium',
                deltaColor,
              )}
            >
              <DeltaIcon className="h-4 w-4" />
              {scoreDelta > 0 ? '+' : ''}
              {scoreDelta.toFixed(1)} this week
            </div>
          )}
          {rank != null && (
            <div className="absolute bottom-5 right-5">
              <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full border border-border bg-card">
                Rank #{rank}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: 'Delegators',
            value: delegatorCount > 0 ? delegatorCount.toLocaleString() : '—',
            icon: Users,
            color: 'text-primary',
          },
          {
            label: 'Participation',
            value: participationRate > 0 ? `${participationRate.toFixed(0)}%` : '—',
            icon: CheckCircle2,
            color:
              participationRate >= 70
                ? 'text-emerald-400'
                : participationRate >= 40
                  ? 'text-amber-400'
                  : participationRate > 0
                    ? 'text-rose-400'
                    : 'text-muted-foreground',
          },
          {
            label: 'Rationale',
            value: rationaleRate > 0 ? `${rationaleRate.toFixed(0)}%` : '—',
            icon: Vote,
            color:
              rationaleRate >= 60
                ? 'text-emerald-400'
                : rationaleRate >= 30
                  ? 'text-amber-400'
                  : rationaleRate > 0
                    ? 'text-rose-400'
                    : 'text-muted-foreground',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-3 space-y-1 text-center"
          >
            <Icon className={cn('h-4 w-4 mx-auto', color)} />
            {summaryLoading ? (
              <Skeleton className="h-5 w-10 mx-auto" />
            ) : (
              <p className={cn('font-display text-xl font-bold tabular-nums', color)}>{value}</p>
            )}
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>

      {/* Inter-body context */}
      {summary?.interBodyAlignment != null && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            Inter-Body Alignment
          </p>
          <p className="text-sm">
            You agreed with DRep consensus on{' '}
            <span className="font-bold text-foreground">
              {summary.interBodyAlignment.drepConsensus ?? '—'}%
            </span>{' '}
            of proposals
            {summary.interBodyAlignment.ccConsensus != null && (
              <>
                {' '}
                and with the Constitutional Committee on{' '}
                <span className="font-bold text-foreground">
                  {summary.interBodyAlignment.ccConsensus}%
                </span>
              </>
            )}
            .
          </p>
        </div>
      )}

      {/* Alignment radar placeholder */}
      {voteCount === 0 && (
        <div className="rounded-xl border border-border bg-card p-5 text-center space-y-2">
          <Shield className="h-6 w-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium text-foreground">Build your governance identity</p>
          <p className="text-xs text-muted-foreground">
            Vote on more proposals to generate your alignment radar and inter-body context.
          </p>
        </div>
      )}

      {/* Pending votes widget */}
      {!pulseLoading && activeProposals > 0 && (
        <Link href="/proposals" className="block group">
          <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4 flex items-center justify-between hover:brightness-110 transition-all">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-200">
                  {activeProposals} proposal{activeProposals > 1 ? 's' : ''} open for voting
                </p>
                <p className="text-xs text-muted-foreground">
                  Cast your pool&apos;s vote to build governance reputation
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </Link>
      )}

      {/* Recent votes */}
      {!votesLoading && recentVotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent Votes
            </p>
            <Link
              href={`/pool/${poolId}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Full history
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentVotes.map((vote: any, idx: number) => {
              const voteDir: string = vote.vote ?? vote.voteDirection ?? '';
              const hasRationale = vote.hasRationale ?? vote.rationale;
              const VoteIcon =
                voteDir === 'Yes' ? CheckCircle2 : voteDir === 'No' ? XCircle : Minus;
              const voteColor =
                voteDir === 'Yes'
                  ? 'text-emerald-400'
                  : voteDir === 'No'
                    ? 'text-rose-400'
                    : 'text-muted-foreground';
              return (
                <div key={idx} className="px-4 py-3 flex items-center gap-3">
                  <VoteIcon className={cn('h-3.5 w-3.5 shrink-0', voteColor)} />
                  <p className="text-sm truncate flex-1">
                    {vote.proposalTitle ?? vote.title ?? 'Proposal'}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasRationale && (
                      <span className="text-[10px] text-emerald-400/70">✓ rationale</span>
                    )}
                    <span className={cn('text-xs font-bold', voteColor)}>{voteDir}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Competitive context */}
      {nearbyPools.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Nearby SPOs
          </p>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {nearbyPools.slice(0, 3).map((pool: any, idx: number) => (
              <Link
                key={pool.poolId ?? idx}
                href={`/pool/${pool.poolId}`}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground tabular-nums w-6">
                    #{pool.rank}
                  </span>
                  <span className="text-sm truncate">
                    {pool.name ?? pool.ticker ?? pool.poolId}
                  </span>
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0">
                  {pool.score?.toFixed(1) ?? '—'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Action feed */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recommended Actions
          </p>
          <ActionFeed actions={actions} />
        </div>
      )}
    </div>
  );
}
