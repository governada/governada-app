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
  Target,
  AlertTriangle,
  FileText,
  RotateCcw,
  Shield,
  Zap,
  Eye,
  Fingerprint,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareModal } from '@/components/civica/shared/ShareModal';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useDRepReportCard,
  useGovernancePulse,
  useDRepVotes,
  useDashboardCompetitive,
  useDashboardUrgent,
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
import { DRepQuestionsInbox } from '@/components/DRepQuestionsInbox';
import { ScoreSimulator } from '@/components/ScoreSimulator';
import type {
  DRepReportCardData,
  PulseData,
  VotesResponseData,
  VoteItem,
  CompetitiveData,
  UrgentData,
  CompetitiveNeighbor,
} from '@/types/api';

const PILLAR_META = [
  { key: 'engagementQuality', label: 'Engagement', icon: Zap, weight: '35%' },
  { key: 'effectiveParticipation', label: 'Participation', icon: Vote, weight: '25%' },
  { key: 'reliability', label: 'Reliability', icon: Shield, weight: '25%' },
  { key: 'governanceIdentity', label: 'Identity', icon: Fingerprint, weight: '15%' },
] as const;

const ALIGNMENT_META = [
  { key: 'treasuryConservative', label: 'Treasury Conservative', color: 'bg-red-500' },
  { key: 'treasuryGrowth', label: 'Treasury Growth', color: 'bg-emerald-500' },
  { key: 'decentralization', label: 'Decentralization', color: 'bg-purple-500' },
  { key: 'security', label: 'Security', color: 'bg-blue-500' },
  { key: 'innovation', label: 'Innovation', color: 'bg-cyan-500' },
  { key: 'transparency', label: 'Transparency', color: 'bg-amber-500' },
] as const;

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

function ScoreSparkline({ history }: { history: { snapshot_date: string; score: number }[] }) {
  if (history.length < 2) return null;
  const sorted = [...history].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime(),
  );
  const scores = sorted.map((h) => h.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const width = 120;
  const height = 32;
  const points = scores
    .map((s, i) => {
      const x = (i / (scores.length - 1)) * width;
      const y = height - ((s - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-[120px] h-8" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary/60"
      />
    </svg>
  );
}

export function DRepCommandCenter({ drepId }: { drepId: string }) {
  const [shareOpen, setShareOpen] = useState(false);
  const {
    data: rawCard,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useDRepReportCard(drepId);
  const { data: rawPulse } = useGovernancePulse();
  const { data: rawVotes, isLoading: votesLoading } = useDRepVotes(drepId);
  const { data: rawCompetitive } = useDashboardCompetitive(drepId);
  const { data: rawUrgent } = useDashboardUrgent(drepId);

  const card = rawCard as DRepReportCardData | undefined;
  const pulse = rawPulse as PulseData | undefined;
  const votesData = rawVotes as VotesResponseData | undefined;
  const votes: VoteItem[] =
    votesData?.votes ?? (Array.isArray(rawVotes) ? (rawVotes as VoteItem[]) : []);
  const allVotes = Array.isArray(votes) ? votes : [];
  const competitive = rawCompetitive as CompetitiveData | undefined;
  const urgent = rawUrgent as UrgentData | undefined;

  const drepScore: number = card?.score ?? 0;
  const drepTier: string = card?.tier ?? computeTier(drepScore) ?? 'Emerging';
  const drepIsActive: boolean = card?.isActive ?? true;
  const delegatorCount: number = card?.delegatorCount ?? 0;
  const scoreDelta: number | undefined = card?.momentum;
  const rationaleRate: number = card?.rationaleRate ?? card?.votingRecord?.rationaleRate ?? 0;
  const participationRate: number = card?.participationRate ?? 0;
  const tierProgress = card?.tierProgress;
  const pillars = card?.pillars;
  const alignment = card?.alignment;
  const scoreHistory: { snapshot_date: string; score: number }[] = card?.scoreHistory ?? [];
  const votingRecord = card?.votingRecord;

  const activeProposals: number = pulse?.activeProposals ?? 0;
  const criticalProposals: number = pulse?.criticalProposals ?? 0;

  const recentVotes = allVotes.slice(0, 5);
  const pendingVotesCount = activeProposals;

  const urgentProposals = urgent?.proposals ?? [];
  const unexplainedVotes = urgent?.unexplainedVotes ?? [];
  const pendingProposals = urgent?.pendingProposals ?? [];
  const pendingCount: number = urgent?.pendingCount ?? 0;

  const rank: number | null = competitive?.rank ?? null;
  const totalActive: number = competitive?.totalActive ?? 0;
  const nearbyAbove: CompetitiveNeighbor[] = competitive?.nearbyAbove ?? [];
  const nearbyBelow: CompetitiveNeighbor[] = competitive?.nearbyBelow ?? [];
  const top10FocusArea = competitive?.top10FocusArea ?? null;
  const distanceToTop10: number = competitive?.distanceToTop10 ?? 0;

  // Show error state if primary query failed
  if (summaryError && !summaryLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Couldn&apos;t load your dashboard</p>
        <p className="text-xs text-muted-foreground">
          Your delegation and votes are safe on-chain.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetchSummary()}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    );
  }

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

  const hasAlignment =
    alignment && ALIGNMENT_META.some((a) => alignment[a.key] != null && alignment[a.key] !== 50);

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
          <div className="absolute top-5 right-5 flex flex-col items-end gap-2">
            {scoreDelta != null && (
              <div className={cn('flex items-center gap-1 text-sm font-medium', deltaColor)}>
                <DeltaIcon className="h-4 w-4" />
                {scoreDelta > 0 ? '+' : ''}
                {scoreDelta.toFixed(1)} this week
              </div>
            )}
            <ScoreSparkline history={scoreHistory} />
          </div>
          {!drepIsActive && (
            <div className="absolute bottom-5 right-5">
              <span className="text-xs text-rose-400 font-medium px-2 py-0.5 rounded-full border border-rose-900/40 bg-rose-950/20">
                Inactive
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tier progress */}
      {!summaryLoading && tierProgress?.pointsToNext != null && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">
                {tierProgress.pointsToNext} points to{' '}
                <span className="text-primary font-bold">{tierProgress.nextTier}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {tierProgress.percentWithinTier}% through {tierProgress.currentTier}
              </p>
            </div>
          </div>
          <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${tierProgress.percentWithinTier}%` }}
            />
          </div>
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

      {/* Pillar breakdown */}
      {!summaryLoading && pillars && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Score Breakdown
          </p>
          <div className="space-y-2.5">
            {PILLAR_META.map(({ key, label, icon: Icon, weight }) => {
              const val = pillars[key] ?? 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-[10px] text-muted-foreground">{weight}</span>
                    </div>
                    <span className="text-sm font-bold tabular-nums">{val.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <motion.div
                      className={cn(
                        'h-full rounded-full',
                        val >= 70 ? 'bg-emerald-500' : val >= 40 ? 'bg-amber-500' : 'bg-rose-500',
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, val)}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 20, delay: 0.2 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {top10FocusArea && (
            <p className="text-xs text-muted-foreground pt-1">
              Focus area vs top 10:{' '}
              <span className="font-medium text-foreground">{top10FocusArea.pillar}</span> (+
              {Math.round(top10FocusArea.gap)} pts gap)
            </p>
          )}
        </div>
      )}

      {/* Score Simulator */}
      {!summaryLoading && <ScoreSimulator drepId={drepId} pendingCount={pendingCount} />}

      {/* 6D Alignment */}
      {!summaryLoading && hasAlignment && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Governance Alignment
          </p>
          <div className="space-y-2">
            {ALIGNMENT_META.map(({ key, label, color }) => {
              const val = alignment[key] ?? 50;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32 shrink-0 truncate">
                    {label}
                  </span>
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', color)}
                      style={{ width: `${Math.min(100, val)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-8 text-right">
                    {Math.round(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Urgent votes */}
      {urgentProposals.length > 0 && (
        <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-200">Expiring Soon</p>
          </div>
          {urgentProposals.slice(0, 3).map((p) => (
            <Link
              key={`${p.txHash}-${p.index}`}
              href={`/proposal/${p.txHash}/${p.index}`}
              className="flex items-center justify-between text-sm py-1.5 hover:text-primary transition-colors"
            >
              <span className="truncate flex-1">{p.title}</span>
              <span className="text-xs text-amber-400 shrink-0 ml-2">
                {p.epochsRemaining === 0 ? 'Last epoch!' : `${p.epochsRemaining}ep left`}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Unexplained votes nudge */}
      {unexplainedVotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {unexplainedVotes.length} vote{unexplainedVotes.length > 1 ? 's' : ''} without
                rationale
              </p>
              <p className="text-xs text-muted-foreground">Adding rationales boosts your score</p>
            </div>
          </div>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Pending votes queue */}
      {pendingProposals.length > 0 && urgentProposals.length === 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">
                {pendingCount} proposal{pendingCount !== 1 ? 's' : ''} awaiting your vote
              </p>
            </div>
            {pendingCount > 5 && (
              <Link
                href="/governance/proposals"
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                View all
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="divide-y divide-border">
            {pendingProposals.map((p) => (
              <Link
                key={`${p.txHash}-${p.index}`}
                href={`/proposal/${p.txHash}/${p.index}`}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/20 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate group-hover:text-primary transition-colors">
                    {p.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.proposalType}
                    {p.epochsRemaining != null && (
                      <span
                        className={cn('ml-1.5', p.epochsRemaining <= 2 ? 'text-amber-400' : '')}
                      >
                        ·{' '}
                        {p.epochsRemaining === 0
                          ? 'Last epoch!'
                          : `${p.epochsRemaining} epoch${p.epochsRemaining !== 1 ? 's' : ''} left`}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-primary font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  Vote
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Delegator questions inbox */}
      <DRepQuestionsInbox drepId={drepId} />

      {/* Competitive context */}
      {rank != null && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Leaderboard Position
            </p>
            <span className="text-xs text-muted-foreground">{totalActive} active DReps</span>
          </div>
          <div className="flex items-center gap-4">
            <p className="font-display text-3xl font-bold tabular-nums text-primary">#{rank}</p>
            {distanceToTop10 > 0 && (
              <p className="text-xs text-muted-foreground">
                {distanceToTop10.toFixed(1)} pts to top 10
              </p>
            )}
          </div>
          {(nearbyAbove.length > 0 || nearbyBelow.length > 0) && (
            <div className="divide-y divide-border/50 rounded-lg border overflow-hidden">
              {nearbyAbove.map((d) => (
                <Link
                  key={d.drepId}
                  href={`/drep/${d.drepId}`}
                  className="px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground tabular-nums w-6">
                      #{d.rank}
                    </span>
                    <span className="text-sm truncate">{d.name}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums shrink-0">
                    {d.score?.toFixed(1)}
                  </span>
                </Link>
              ))}
              <div className="px-3 py-2 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary tabular-nums w-6">#{rank}</span>
                  <span className="text-sm font-bold text-primary">You</span>
                </div>
                <span className="text-sm font-bold tabular-nums text-primary">
                  {drepScore.toFixed(1)}
                </span>
              </div>
              {nearbyBelow.map((d) => (
                <Link
                  key={d.drepId}
                  href={`/drep/${d.drepId}`}
                  className="px-3 py-2 flex items-center justify-between hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground tabular-nums w-6">
                      #{d.rank}
                    </span>
                    <span className="text-sm truncate">{d.name}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums shrink-0">
                    {d.score?.toFixed(1)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
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
            {recentVotes.map((vote, idx: number) => {
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
                <Link
                  key={idx}
                  href={
                    vote.proposalTxHash
                      ? `/proposal/${vote.proposalTxHash}/${vote.proposalIndex}`
                      : '#'
                  }
                  className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                >
                  <VoteIcon className={cn('h-3.5 w-3.5 shrink-0', voteColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {vote.proposalTitle ?? vote.title ?? 'Proposal'}
                    </p>
                    {vote.proposalType && (
                      <p className="text-[10px] text-muted-foreground">{vote.proposalType}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {vote.hasRationale && (
                      <span className="text-[10px] text-emerald-400/70">rationale</span>
                    )}
                    <span className={cn('text-xs font-bold', voteColor)}>{voteDir}</span>
                  </div>
                </Link>
              );
            })}
          </div>
          {votingRecord && (
            <p className="text-xs text-muted-foreground text-center">
              {votingRecord.totalVotes} total votes &middot; {votingRecord.rationalesProvided}{' '}
              rationales
            </p>
          )}
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
        shareText={`My governance score on @GovernadaIO — check it out!`}
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : 'https://governada.io'}/drep/${encodeURIComponent(drepId)}`}
        title="Share your profile"
      />
    </div>
  );
}
