'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Vote,
  Coins,
  Flame,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  Wallet,
  Server,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { briefingContainer, briefingItem } from '@/lib/animations';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  useEpochConsequence,
  useGovernanceHolder,
  useCitizenImpactScore,
  useSPOSummary,
  type ConsequenceProposal,
} from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { resolveRewardAddress } from '@meshsdk/core';
import { hapticLight } from '@/lib/haptics';
import { useSentimentResults } from '@/hooks/useEngagement';
import { CommunityConsensus } from './CommunityConsensus';
import { WhatChanged } from '@/components/hub/WhatChanged';

type SentimentChoice = 'support' | 'oppose' | 'unsure';

/* ── Helpers ─────────────────────────────────────────────────── */

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

function formatPowerFraction(fraction: number): string {
  if (fraction >= 0.01) return `${(fraction * 100).toFixed(1)}%`;
  if (fraction >= 0.001) return `${(fraction * 100).toFixed(2)}%`;
  return `${(fraction * 100).toFixed(3)}%`;
}

const OUTCOME_CONFIG = {
  ratified: {
    icon: CheckCircle2,
    label: 'Ratified',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  dropped: {
    icon: XCircle,
    label: 'Dropped',
    color: 'text-red-500',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  expired: {
    icon: Clock,
    label: 'Expired',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
} as const;

const VOTE_LABELS: Record<string, { label: string; color: string }> = {
  Yes: { label: 'Voted Yes', color: 'text-emerald-400' },
  No: { label: 'Voted No', color: 'text-red-400' },
  Abstain: { label: 'Abstained', color: 'text-amber-400' },
};

const PROPOSAL_TYPE_LABELS: Record<string, string> = {
  TreasuryWithdrawals: 'Treasury',
  ParameterChange: 'Parameter Change',
  HardForkInitiation: 'Hard Fork',
  InfoAction: 'Info Action',
  NoConfidence: 'No Confidence',
  NewConstitution: 'Constitution',
  UpdateCommittee: 'Committee Update',
};

/* ── Section wrapper (glassmorphic) ──────────────────────────── */

function Section({
  children,
  className,
  ...rest
}: { children: React.ReactNode; className?: string } & Record<string, unknown>) {
  return (
    <motion.section
      variants={briefingItem}
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 sm:p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

/* ── Consequence card for a decided proposal ─────────────────── */

function ConsequenceCard({ proposal }: { proposal: ConsequenceProposal }) {
  const outcome = proposal.outcome ? OUTCOME_CONFIG[proposal.outcome] : null;
  const OutcomeIcon = outcome?.icon ?? Clock;
  const voteInfo = proposal.drepVote ? VOTE_LABELS[proposal.drepVote] : null;
  const typeLabel = PROPOSAL_TYPE_LABELS[proposal.proposalType] ?? proposal.proposalType;

  return (
    <Link
      href={`/proposal/${proposal.txHash}/${proposal.index}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 transition-all hover:border-primary/40 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Outcome badge + type */}
          <div className="flex items-center gap-2 flex-wrap">
            {outcome && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  outcome.bg,
                  outcome.color,
                )}
              >
                <OutcomeIcon className="h-3 w-3" />
                {outcome.label}
              </span>
            )}
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {typeLabel}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {proposal.title ?? 'Untitled Proposal'}
          </p>

          {/* DRep vote + community signal row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {voteInfo && (
              <span className={cn('font-medium', voteInfo.color)}>{voteInfo.label}</span>
            )}
            {!voteInfo && proposal.drepVote === null && (
              <span className="text-muted-foreground/60">DRep didn&apos;t vote</span>
            )}
            {proposal.communitySignal && proposal.communitySignal.total > 0 && (
              <CommunitySignalInline signal={proposal.communitySignal} />
            )}
            {proposal.withdrawalAda && proposal.withdrawalAda > 0 && (
              <span className="tabular-nums">{formatAda(proposal.withdrawalAda)} ADA</span>
            )}
          </div>
        </div>

        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

/* ── Inline community signal bar ─────────────────────────────── */

function CommunitySignalInline({
  signal,
}: {
  signal: { support: number; oppose: number; total: number };
}) {
  const supportPct = Math.round((signal.support / signal.total) * 100);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-1.5 w-8 rounded-full bg-muted overflow-hidden">
        <span className="h-full bg-emerald-500 rounded-full" style={{ width: `${supportPct}%` }} />
      </span>
      <span className="tabular-nums text-[10px]">{supportPct}% support</span>
    </span>
  );
}

/* ── Active proposal card with inline sentiment voting ────────── */

function ActiveProposalCard({ proposal }: { proposal: ConsequenceProposal }) {
  const voteInfo = proposal.drepVote ? VOTE_LABELS[proposal.drepVote] : null;
  const typeLabel = PROPOSAL_TYPE_LABELS[proposal.proposalType] ?? proposal.proposalType;
  const { connected, isAuthenticated, address, delegatedDrepId, authenticate } = useWallet();
  const queryClient = useQueryClient();
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Fetch real-time sentiment for inline display
  const { data: sentimentData } = useSentimentResults(proposal.txHash, proposal.index);
  const hasVoted = sentimentData?.hasVoted ?? !!proposal.userSignal;
  const userSentiment =
    sentimentData?.userSentiment ?? (proposal.userSignal as SentimentChoice | null);
  const community = sentimentData?.community ??
    proposal.communitySignal ?? { support: 0, oppose: 0, unsure: 0, total: 0 };

  const castVote = async (sentiment: SentimentChoice) => {
    hapticLight();
    if (!isAuthenticated) {
      const ok = await authenticate();
      if (!ok) return;
    }

    setVoting(true);
    setVoteError(null);

    try {
      const token = getStoredSession();
      if (!token) throw new Error('Not authenticated');

      let stakeAddress: string | undefined;
      if (address) {
        try {
          stakeAddress = resolveRewardAddress(address);
        } catch {
          /* script addresses won't resolve */
        }
      }

      const res = await fetch('/api/engagement/sentiment/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposalTxHash: proposal.txHash,
          proposalIndex: proposal.index,
          sentiment,
          stakeAddress,
          delegatedDrepId,
        }),
      });

      if (res.status === 429) throw new Error('Vote limit reached.');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Vote failed');
      }

      await queryClient.invalidateQueries({
        queryKey: ['citizen-sentiment', proposal.txHash, proposal.index],
      });

      import('@/lib/posthog')
        .then(({ posthog }) => {
          posthog.capture('citizen_sentiment_voted_hub', {
            proposal_tx_hash: proposal.txHash,
            proposal_index: proposal.index,
            sentiment,
            source: 'citizen_hub',
          });
        })
        .catch(() => {});
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 space-y-2">
      <Link href={`/proposal/${proposal.txHash}/${proposal.index}`} className="group block">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                <Vote className="h-3 w-3" />
                Active
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {typeLabel}
              </span>
            </div>

            <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {proposal.title ?? 'Untitled Proposal'}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {voteInfo && (
                <span className={cn('font-medium', voteInfo.color)}>
                  DRep {voteInfo.label.toLowerCase()}
                </span>
              )}
              {!voteInfo && <span className="text-amber-400/80">DRep hasn&apos;t voted yet</span>}
              {community.total > 0 && <CommunitySignalInline signal={community} />}
            </div>
          </div>

          <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
        </div>
      </Link>

      {/* Already voted */}
      {hasVoted && userSentiment && (
        <div className="flex items-center gap-2 text-xs pt-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
          <span>
            You: <strong className="capitalize">{userSentiment}</strong>
          </span>
        </div>
      )}

      {/* Inline sentiment buttons for connected users who haven't voted */}
      {!hasVoted && connected && (
        <div className="flex gap-1.5 pt-1" role="radiogroup" aria-label="Share your sentiment">
          {[
            {
              vote: 'support' as SentimentChoice,
              label: 'Support',
              icon: ThumbsUp,
              cls: 'hover:border-green-500/50 hover:bg-green-500/5',
            },
            {
              vote: 'oppose' as SentimentChoice,
              label: 'Oppose',
              icon: ThumbsDown,
              cls: 'hover:border-red-500/50 hover:bg-red-500/5',
            },
            {
              vote: 'unsure' as SentimentChoice,
              label: 'Unsure',
              icon: HelpCircle,
              cls: 'hover:border-amber-500/50 hover:bg-amber-500/5',
            },
          ].map(({ vote, label, icon: Icon, cls }) => (
            <button
              key={vote}
              onClick={() => castVote(vote)}
              disabled={voting}
              role="radio"
              aria-checked={false}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border/50 px-2 py-1.5 text-[10px] font-medium',
                'transition-all duration-150 motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]',
                cls,
              )}
            >
              {voting ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Connect CTA for unconnected users */}
      {!hasVoted && !connected && (
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-1.5 text-[10px] h-7"
          onClick={() => {
            const event = new CustomEvent('openWalletConnect');
            window.dispatchEvent(event);
          }}
        >
          <Wallet className="h-3 w-3" />
          Connect to share your opinion
        </Button>
      )}

      {voteError && <p className="text-[10px] text-destructive">{voteError}</p>}
    </div>
  );
}

/* ── Footprint stat ──────────────────────────────────────────── */

function FootprintStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Vote;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────────── */

function CitizenHubSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      {/* Headline skeleton */}
      <div className="space-y-2 py-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 space-y-3"
        >
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Pool + coverage indicator (inline in representation) ───── */

function PoolAndCoverage({
  delegatedDrep,
  delegatedPool,
  poolRaw,
}: {
  delegatedDrep: string | null;
  delegatedPool: string | null;
  poolRaw: unknown;
}) {
  const pool = poolRaw as Record<string, unknown> | undefined;
  const poolName = (pool?.poolName as string) || (pool?.ticker as string) || null;
  const ticker = (pool?.ticker as string) ?? '';
  const govScore = Math.round((pool?.governanceScore as number) ?? 0);
  const poolParticipation = Math.round((pool?.participationRate as number) ?? 0);
  const poolVoteCount = (pool?.voteCount as number) ?? 0;
  const poolIsGovActive = poolVoteCount > 0;

  // Coverage calculation (mirrors DelegationPage CoverageSummary logic)
  const hasDrep = !!delegatedDrep;
  const hasPool = !!delegatedPool;
  const coveredTypes = hasDrep ? 5 : 0;
  const poolCoveredTypes = hasPool && poolIsGovActive ? 2 : 0;
  const totalTypes = 7;
  const covered = coveredTypes + poolCoveredTypes;
  const coveragePct = Math.round((covered / totalTypes) * 100);

  let coverageLabel: string;
  let coverageColor: string;
  if (coveragePct === 100) {
    coverageLabel = 'Full coverage';
    coverageColor = 'text-emerald-400';
  } else if (coveragePct >= 50) {
    coverageLabel = 'Partial coverage';
    coverageColor = 'text-amber-400';
  } else {
    coverageLabel = 'Low coverage';
    coverageColor = 'text-red-400';
  }

  return (
    <div className="mt-3 space-y-3 pt-3 border-t border-white/[0.06]">
      {/* Coverage indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Governance coverage</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', coverageColor)}>{coverageLabel}</span>
          <span className={cn('text-xs font-bold tabular-nums', coverageColor)}>
            {coveragePct}%
          </span>
        </div>
      </div>

      {/* Compact coverage bar */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            coveragePct === 100
              ? 'bg-emerald-500'
              : coveragePct >= 50
                ? 'bg-amber-500'
                : 'bg-red-500',
          )}
          style={{ width: `${coveragePct}%` }}
        />
      </div>

      {/* Pool info */}
      {delegatedPool && poolName && (
        <Link
          href={`/pool/${encodeURIComponent(delegatedPool)}`}
          className="flex items-center justify-between gap-3 group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {ticker ? `[${ticker}] ` : ''}
                {poolName}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">Gov score: {govScore}</span>
              <span className="text-muted-foreground/40">&middot;</span>
              <span className="tabular-nums">{poolParticipation}% participation</span>
            </div>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
        </Link>
      )}

      {delegatedPool && !poolName && !pool && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Server className="h-3.5 w-3.5" />
          <span>Pool delegated</span>
        </div>
      )}

      {!delegatedPool && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
          <Server className="h-3.5 w-3.5" />
          <span>No stake pool — 2 action types unrepresented</span>
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export function CitizenHub() {
  const { stakeAddress, delegatedDrep, delegatedPool } = useSegment();

  const {
    data: consequence,
    isLoading: consequenceLoading,
    isError: consequenceError,
  } = useEpochConsequence(stakeAddress);

  const { data: holderRaw, isLoading: holderLoading } = useGovernanceHolder(stakeAddress);
  const { data: impactScore } = useCitizenImpactScore(!!stakeAddress);
  const { data: poolRaw } = useSPOSummary(delegatedPool);

  const isLoading = consequenceLoading || holderLoading;

  if (isLoading) return <CitizenHubSkeleton />;

  // Extract DRep data from holder
  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || 'Your DRep';
  const drepScore = (drep?.score as number) ?? 0;
  const drepIsActive = (drep?.isActive as boolean) ?? true;
  const participationRate = (drep?.participationRate as number) ?? 0;
  const footprint = holder?.footprint as Record<string, unknown> | undefined;

  // Consequence data
  const epoch = consequence?.epoch ?? 0;
  const adaDecided = consequence?.adaDecided ?? 0;
  const decidedProposals = consequence?.decidedProposals ?? [];
  const activeProposals = consequence?.activeProposals ?? [];
  const votingPowerFraction = consequence?.votingPowerFraction;
  const votingPowerAda = consequence?.votingPowerAda;

  // Footprint stats from holder or consequence
  const proposalsInfluenced = (footprint?.proposalsInfluenced as number) ?? decidedProposals.length;
  const delegationStreak = (footprint?.delegationStreak as number) ?? 0;
  const adaGoverned = votingPowerAda ?? 0;

  // Build headline
  const headlineText =
    adaDecided > 0
      ? `Your delegation helped decide ${formatAda(adaDecided)} ADA`
      : decidedProposals.length > 0
        ? `${decidedProposals.length} governance decision${decidedProposals.length !== 1 ? 's' : ''} this epoch`
        : 'No governance decisions yet this epoch';

  return (
    <motion.div
      variants={briefingContainer}
      initial="hidden"
      animate="visible"
      className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6"
    >
      {/* ── What Changed (return visit summary) ──────────── */}
      <WhatChanged />

      {/* ── Epoch headline ─────────────────────────────────── */}
      <motion.header
        variants={briefingItem}
        className="space-y-1 pb-1"
        data-discovery="hub-briefing"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Epoch {epoch}
        </p>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
          {headlineText}
        </h1>
        {votingPowerFraction != null && votingPowerFraction > 0 && (
          <p className="text-sm text-muted-foreground">
            Your voice represents {formatPowerFraction(votingPowerFraction)} of total voting power
            {votingPowerAda ? ` (${formatAda(votingPowerAda)} ADA)` : ''}
          </p>
        )}
      </motion.header>

      {/* ── Decided proposals ──────────────────────────────── */}
      {decidedProposals.length > 0 && (
        <Section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            What was decided
          </h2>
          <div className="space-y-2">
            {decidedProposals.map((p) => (
              <ConsequenceCard key={`${p.txHash}:${p.index}`} proposal={p} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Active proposals ───────────────────────────────── */}
      {activeProposals.length > 0 && (
        <Section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Being decided now
            </h2>
            <Link
              href="/governance/proposals"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              View all
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeProposals.map((p) => (
              <ActiveProposalCard key={`${p.txHash}:${p.index}`} proposal={p} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Empty state ────────────────────────────────────── */}
      {consequenceError && (
        <Section className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load governance activity. Try refreshing.
          </p>
        </Section>
      )}

      {!consequenceError && decidedProposals.length === 0 && activeProposals.length === 0 && (
        <Section className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            No governance proposals this epoch yet. Check back soon.
          </p>
          <Link
            href="/governance"
            className="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:underline"
          >
            Explore governance
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Section>
      )}

      {/* ── Governance footprint ───────────────────────────── */}
      <Section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Your governance footprint
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <FootprintStat icon={Vote} value={proposalsInfluenced} label="Proposals Influenced" />
          <FootprintStat
            icon={Coins}
            value={adaGoverned > 0 ? formatAda(adaGoverned) : '--'}
            label="ADA Governed"
          />
          <FootprintStat icon={Flame} value={delegationStreak} label="Epoch Streak" />
          <FootprintStat
            icon={TrendingUp}
            value={impactScore?.computed ? Math.round(impactScore.score) : '--'}
            label="Impact Score"
          />
        </div>
      </Section>

      {/* ── Community Consensus (feature-flagged) ────────── */}
      <CommunityConsensus />

      {/* ── Representation quality ─────────────────────────── */}
      <Section data-discovery="hub-representation">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Your representation
        </h2>

        {!delegatedDrep && (
          <Link href="/match" className="flex items-center justify-between gap-3 group">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-foreground">Unrepresented</span>
              </div>
              <p className="text-xs text-muted-foreground">Find a DRep who shares your values</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
          </Link>
        )}

        {delegatedDrep &&
          delegatedDrep !== 'drep_always_abstain' &&
          delegatedDrep !== 'drep_always_no_confidence' &&
          drep && (
            <Link
              href={`/drep/${encodeURIComponent(delegatedDrep)}`}
              className="flex items-center justify-between gap-3 group"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {drepIsActive ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ShieldX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{drepName}</span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
                      drepIsActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400',
                    )}
                  >
                    {drepIsActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    Score: {Math.round(drepScore)} &middot; {computeTier(drepScore)}
                  </span>
                  <span className="text-muted-foreground/40">&middot;</span>
                  <span className="tabular-nums">
                    {Math.round(participationRate)}% participation
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
            </Link>
          )}

        {delegatedDrep === 'drep_always_abstain' && (
          <Link href="/match" className="flex items-center justify-between gap-3 group">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Always Abstain</p>
              <p className="text-xs text-muted-foreground">
                Your ADA abstains on all governance actions but counts toward quorum.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
          </Link>
        )}

        {delegatedDrep === 'drep_always_no_confidence' && (
          <Link href="/match" className="flex items-center justify-between gap-3 group">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No Confidence</p>
              <p className="text-xs text-muted-foreground">
                Your vote weight counts against all proposals.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
          </Link>
        )}

        {/* ── Pool + Coverage ───────────────────────────────────── */}
        <PoolAndCoverage
          delegatedDrep={delegatedDrep}
          delegatedPool={delegatedPool}
          poolRaw={poolRaw}
        />
      </Section>

      {/* ── Quick links ────────────────────────────────────── */}
      <motion.div
        variants={briefingItem}
        className="flex items-center justify-center gap-4 pt-2 pb-4"
        data-discovery="hub-actions"
      >
        <Link
          href="/governance"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Governance overview
        </Link>
        <span className="text-muted-foreground/30">&middot;</span>
        <Link
          href="/match"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Find a DRep
        </Link>
      </motion.div>
    </motion.div>
  );
}
