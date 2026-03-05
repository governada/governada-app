'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
  Share2,
} from 'lucide-react';
import { ShareModal } from '@/components/civica/shared/ShareModal';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useDRepReportCard, useGovernancePulse, useDRepVotes } from '@/hooks/queries';
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

function ScoreGauge({ score, tier }: { score: number; tier: string }) {
  const tKey = tierKey(tier);
  return (
    <div className={cn('rounded-xl border p-5 space-y-3', TIER_BORDER[tKey], TIER_BG[tKey])}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
        Your DRep Score
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
        <motion.div
          className="h-full rounded-full bg-current"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, score)}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.3 }}
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

export function DRepCommandCenter({ drepId }: { drepId: string }) {
  const [shareOpen, setShareOpen] = useState(false);
  const { data: rawCard, isLoading: summaryLoading } = useDRepReportCard(drepId);
  const { data: rawPulse, isLoading: pulseLoading } = useGovernancePulse();
  const { data: rawVotes, isLoading: votesLoading } = useDRepVotes(drepId);

  const card = rawCard as any;
  const pulse = rawPulse as any;
  const votes: any[] = (rawVotes as any)?.votes ?? rawVotes ?? [];
  const allVotes = Array.isArray(votes) ? votes : [];

  const drepScore: number = card?.score ?? 0;
  const drepTier: string = card?.tier ?? computeTier(drepScore) ?? 'Emerging';
  const drepIsActive: boolean = card?.isActive ?? true;
  const delegatorCount: number = card?.delegatorCount ?? 0;
  const scoreDelta: number | undefined = card?.momentum;
  const rationaleRate: number = card?.rationaleRate ?? card?.votingRecord?.rationaleRate ?? 0;
  const participationRate: number = card?.participationRate ?? 0;

  const activeProposals: number = pulse?.activeProposals ?? 0;
  const criticalProposals: number = pulse?.criticalProposals ?? 0;
  const votesThisWeek: number = pulse?.votesThisWeek ?? 0;

  const recentVotes = allVotes.slice(0, 5);
  const pendingVotesCount = activeProposals;

  const actions = generateActions({
    segment: 'drep',
    activeProposals,
    criticalProposals,
    drepScore,
    scoreDelta,
    drepIsActive,
    pendingVotesCount,
    drepTier,
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
      {/* Score hero */}
      {summaryLoading ? (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-5 w-16" />
        </div>
      ) : (
        <div className="relative">
          <ScoreGauge score={drepScore} tier={drepTier} />
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
          {!drepIsActive && (
            <div className="absolute bottom-5 right-5">
              <span className="text-xs text-rose-400 font-medium px-2 py-0.5 rounded-full border border-rose-900/40 bg-rose-950/20">
                Inactive
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
            value: delegatorCount.toLocaleString(),
            icon: Users,
            color: 'text-primary',
          },
          {
            label: 'Participation',
            value: `${participationRate.toFixed(0)}%`,
            icon: CheckCircle2,
            color:
              participationRate >= 70
                ? 'text-emerald-400'
                : participationRate >= 40
                  ? 'text-amber-400'
                  : 'text-rose-400',
          },
          {
            label: 'Rationale',
            value: `${rationaleRate.toFixed(0)}%`,
            icon: Vote,
            color:
              rationaleRate >= 60
                ? 'text-emerald-400'
                : rationaleRate >= 30
                  ? 'text-amber-400'
                  : 'text-rose-400',
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

      {/* Pending votes widget */}
      {!pulseLoading && activeProposals > 0 && (
        <Link href="/proposals" className="block group">
          <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4 flex items-center justify-between hover:brightness-110 transition-all">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-200">
                  {activeProposals} proposal{activeProposals > 1 ? 's' : ''} awaiting your vote
                </p>
                <p className="text-xs text-muted-foreground">
                  {votesThisWeek} votes cast network-wide this week
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
              href={`/drep/${drepId}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Full history
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {recentVotes.map((vote: any, idx: number) => {
              const voteDir: string = vote.vote ?? vote.voteDirection ?? '';
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
                  <span className={cn('text-xs font-bold shrink-0', voteColor)}>{voteDir}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action feed */}
      {actions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {actions.length === 1 ? 'Action Required' : 'Recommended Actions'}
          </p>
          <ActionFeed actions={actions} emphasizeFirst />
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 px-5 py-4 text-center space-y-1">
          <p className="text-sm font-medium text-emerald-300">All caught up</p>
          <p className="text-xs text-muted-foreground">
            No proposals need your vote right now. Use this time to write a governance statement or
            review your rationale quality.
          </p>
        </div>
      )}

      {/* Share profile CTA */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={() => setShareOpen(true)}
          className="w-full flex items-center gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <Share2 className="h-4 w-4" />
          Share your profile
        </button>
      </div>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        ogImageUrl={`/api/og/wrapped/drep/${encodeURIComponent(drepId)}`}
        shareText={`My governance score on @DRepScore — check it out!`}
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : 'https://drepscore.app'}/drep/${encodeURIComponent(drepId)}`}
        title="Share your profile"
      />
    </div>
  );
}
