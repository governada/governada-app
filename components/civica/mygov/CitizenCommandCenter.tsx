'use client';

import Link from 'next/link';
import { Users, ChevronRight, Vote, TrendingUp, TrendingDown, Minus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useGovernanceSummary, useGovernancePulse, useDRepVotes } from '@/hooks/queries';
import {
  tierKey,
  TIER_SCORE_COLOR,
  TIER_BADGE_BG,
  TIER_BORDER,
} from '@/components/civica/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';
import { generateActions } from '@/lib/actionFeed';
import { ActionFeed } from './ActionFeed';

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.min(100, score)}%` }}
      />
    </div>
  );
}

export function CitizenCommandCenter({
  delegatedDrep,
}: {
  delegatedDrep: string | null | undefined;
}) {
  const { data: rawDrep, isLoading: drepLoading } = useGovernanceSummary(delegatedDrep);
  const { data: rawPulse, isLoading: pulseLoading } = useGovernancePulse();
  const { data: rawVotes, isLoading: votesLoading } = useDRepVotes(delegatedDrep);

  const drep = rawDrep as any;
  const pulse = rawPulse as any;
  const votes: any[] = (rawVotes as any)?.votes ?? rawVotes ?? [];
  const recentVotes = Array.isArray(votes) ? votes.slice(0, 3) : [];

  const drepScore: number = drep?.drepScore ?? drep?.score ?? 0;
  const drepName: string = drep?.name ?? drep?.givenName ?? delegatedDrep ?? '—';
  const drepIsActive: boolean = drep?.isActive ?? drep?.active ?? true;
  const drepTier = tierKey(computeTier(drepScore));
  const scoreDelta: number | undefined = drep?.scoreDelta ?? drep?.weeklyDelta ?? drep?.recentTrend;

  const activeProposals: number = pulse?.activeProposals ?? 0;
  const criticalProposals: number = pulse?.criticalProposals ?? 0;

  const actions = generateActions({
    segment: 'citizen',
    activeProposals,
    criticalProposals,
    delegatedDrep,
    delegatedDrepScore: drepScore,
    delegatedDrepIsActive: drepIsActive,
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

  return (
    <div className="space-y-6">
      {/* Delegation health card */}
      {delegatedDrep ? (
        <Link href={`/drep/${delegatedDrep}`} className="block group">
          <div
            className={cn(
              'rounded-xl border p-5 space-y-4 transition-colors group-hover:border-primary/30',
              TIER_BORDER[drepTier],
            )}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Your Delegated DRep
                </p>
                {drepLoading ? (
                  <Skeleton className="h-6 w-40" />
                ) : (
                  <p className="text-lg font-bold leading-tight truncate max-w-[220px]">
                    {drepName}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      'text-[11px] font-bold px-2 py-0.5 rounded-full',
                      TIER_BADGE_BG[drepTier],
                      TIER_SCORE_COLOR[drepTier],
                    )}
                  >
                    {drepTier}
                  </span>
                  {!drepIsActive && (
                    <span className="text-[11px] text-rose-400 font-medium">Inactive</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {drepLoading ? (
                  <Skeleton className="h-10 w-16" />
                ) : (
                  <>
                    <p
                      className={cn(
                        'font-display text-3xl font-bold tabular-nums',
                        TIER_SCORE_COLOR[drepTier],
                      )}
                    >
                      {drepScore.toFixed(0)}
                    </p>
                    {scoreDelta != null && (
                      <div
                        className={cn('flex items-center justify-end gap-0.5 text-xs', deltaColor)}
                      >
                        <DeltaIcon className="h-3 w-3" />
                        {scoreDelta > 0 ? '+' : ''}
                        {scoreDelta.toFixed(1)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <ScoreBar score={drepScore} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
              View full profile <ChevronRight className="h-3 w-3" />
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-8 text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground">Find Your DRep</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Delegate to a DRep aligned with your values to participate in Cardano governance. It
              takes 60 seconds.
            </p>
          </div>
          <Link
            href="/match"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
          >
            Quick Match <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <p className="text-xs text-muted-foreground">
            Or{' '}
            <Link href="/discover" className="text-primary hover:underline">
              browse all DReps
            </Link>
          </p>
        </div>
      )}

      {/* Open proposals callout */}
      {!pulseLoading && activeProposals > 0 && (
        <Link href="/proposals" className="block group">
          <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3">
              <Vote className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {activeProposals} open proposal{activeProposals > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {criticalProposals > 0 ? `${criticalProposals} critical` : 'Your DRep is voting'}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </Link>
      )}

      {/* Recent DRep votes */}
      {!votesLoading && recentVotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Recent DRep Votes
            </p>
            <Link
              href={delegatedDrep ? `/drep/${delegatedDrep}` : '/discover'}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              See all
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentVotes.map((vote: any, idx: number) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <p className="text-sm truncate max-w-[200px]">
                  {vote.proposalTitle ?? vote.title ?? 'Proposal'}
                </p>
                <span
                  className={cn(
                    'text-xs font-bold shrink-0 ml-2',
                    vote.vote === 'Yes'
                      ? 'text-emerald-400'
                      : vote.vote === 'No'
                        ? 'text-rose-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {vote.vote ?? vote.voteDirection ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action feed */}
      {actions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recommended Actions
          </p>
          <ActionFeed actions={actions} />
        </div>
      ) : delegatedDrep ? (
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-4 text-center space-y-1">
          <p className="text-sm font-medium text-emerald-300">Your governance is healthy</p>
          <p className="text-xs text-muted-foreground">
            {drepName !== '—'
              ? `${drepName} voted on all proposals this epoch. No action needed.`
              : 'Your DRep is active and participating. No action needed.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
