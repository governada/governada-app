'use client';

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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { briefingContainer, briefingItem } from '@/lib/animations';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  useEpochConsequence,
  useGovernanceHolder,
  type ConsequenceProposal,
} from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';
import { Skeleton } from '@/components/ui/skeleton';

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

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      variants={briefingItem}
      className={cn(
        'rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-4 sm:p-5',
        className,
      )}
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
      href={`/governance/proposals/${proposal.txHash}/${proposal.index}`}
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

/* ── Active proposal card with signal buttons ────────────────── */

function ActiveProposalCard({ proposal }: { proposal: ConsequenceProposal }) {
  const voteInfo = proposal.drepVote ? VOTE_LABELS[proposal.drepVote] : null;
  const typeLabel = PROPOSAL_TYPE_LABELS[proposal.proposalType] ?? proposal.proposalType;

  return (
    <Link
      href={`/governance/proposals/${proposal.txHash}/${proposal.index}`}
      className="group block rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 transition-all hover:border-primary/40 hover:bg-white/[0.05]"
    >
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

          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
            {proposal.title ?? 'Untitled Proposal'}
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {voteInfo && (
              <span className={cn('font-medium', voteInfo.color)}>
                DRep {voteInfo.label.toLowerCase()}
              </span>
            )}
            {!voteInfo && <span className="text-amber-400/80">DRep hasn&apos;t voted yet</span>}
            {proposal.communitySignal && proposal.communitySignal.total > 0 && (
              <CommunitySignalInline signal={proposal.communitySignal} />
            )}
            {proposal.userSignal && (
              <span className="flex items-center gap-1">
                {proposal.userSignal === 'support' && (
                  <ThumbsUp className="h-3 w-3 text-emerald-400" />
                )}
                {proposal.userSignal === 'oppose' && (
                  <ThumbsDown className="h-3 w-3 text-red-400" />
                )}
                {proposal.userSignal === 'unsure' && (
                  <HelpCircle className="h-3 w-3 text-amber-400" />
                )}
                <span className="text-[10px]">You: {proposal.userSignal}</span>
              </span>
            )}
            {!proposal.userSignal && (
              <span className="text-primary/70 text-[10px] font-medium">
                Share your opinion &rarr;
              </span>
            )}
          </div>
        </div>

        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
      </div>
    </Link>
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

/* ── Main component ──────────────────────────────────────────── */

export function CitizenHub() {
  const { stakeAddress, delegatedDrep } = useSegment();

  const {
    data: consequence,
    isLoading: consequenceLoading,
    isError: consequenceError,
  } = useEpochConsequence(stakeAddress);

  const { data: holderRaw, isLoading: holderLoading } = useGovernanceHolder(stakeAddress);

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
      {/* ── Epoch headline ─────────────────────────────────── */}
      <motion.header variants={briefingItem} className="space-y-1 pb-1">
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
        <div className="grid grid-cols-3 gap-2">
          <FootprintStat icon={Vote} value={proposalsInfluenced} label="Proposals Influenced" />
          <FootprintStat
            icon={Coins}
            value={adaGoverned > 0 ? formatAda(adaGoverned) : '--'}
            label="ADA Governed"
          />
          <FootprintStat icon={Flame} value={delegationStreak} label="Epoch Streak" />
        </div>
      </Section>

      {/* ── Representation quality ─────────────────────────── */}
      <Section>
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
            <Link href="/delegation" className="flex items-center justify-between gap-3 group">
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
          <Link href="/delegation" className="flex items-center justify-between gap-3 group">
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
          <Link href="/delegation" className="flex items-center justify-between gap-3 group">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">No Confidence</p>
              <p className="text-xs text-muted-foreground">
                Your vote weight counts against all proposals.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-all group-hover:translate-x-0.5" />
          </Link>
        )}
      </Section>

      {/* ── Quick links ────────────────────────────────────── */}
      <motion.div
        variants={briefingItem}
        className="flex items-center justify-center gap-4 pt-2 pb-4"
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
        <span className="text-muted-foreground/30">&middot;</span>
        <Link
          href="/delegation"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          My delegation
        </Link>
      </motion.div>
    </motion.div>
  );
}
