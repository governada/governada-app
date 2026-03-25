'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Clock, Landmark, AlertTriangle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeIn, spring } from '@/lib/animations';
import { AnimatedScore } from './AnimatedScore';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import { getProposalTheme, getVerdict } from '@/components/governada/proposals/proposal-theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface VoteBarProps {
  label: string;
  yes: number;
  no: number;
  abstain: number;
  delay: number;
  immediate: boolean;
}

function VoteBar({ label, yes, no, abstain, delay, immediate }: VoteBarProps) {
  const total = yes + no + abstain;
  if (total === 0) return null;

  const yesPct = (yes / total) * 100;
  const noPct = (no / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {Math.round(yesPct)}% / {Math.round(noPct)}%
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full bg-emerald-500/80"
          initial={immediate ? { width: `${yesPct}%` } : { width: '0%' }}
          animate={{ width: `${yesPct}%` }}
          transition={immediate ? { duration: 0 } : { ...spring.smooth, delay }}
        />
        <motion.div
          className="h-full bg-red-500/80"
          initial={immediate ? { width: `${noPct}%` } : { width: '0%' }}
          animate={{ width: `${noPct}%` }}
          transition={immediate ? { duration: 0 } : { ...spring.smooth, delay: delay + 0.1 }}
        />
      </div>
    </div>
  );
}

// ─── Outcome Badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ status, expirationEpoch }: { status: string; expirationEpoch?: number }) {
  const s = status.toLowerCase();
  const epochLabel = expirationEpoch ? ` Ep ${expirationEpoch}` : '';

  if (s === 'ratified') {
    return (
      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-400">
        Ratified{epochLabel}
      </span>
    );
  }
  if (s === 'enacted') {
    return (
      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
        Enacted{epochLabel}
      </span>
    );
  }
  if (s === 'expired') {
    return (
      <span className="rounded-full border border-zinc-500/20 bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
        Expired
      </span>
    );
  }
  if (s === 'dropped') {
    return (
      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
        Dropped
      </span>
    );
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SpotlightProposalCardProps {
  proposal: BrowseProposal;
  currentEpoch: number | null;
  isTracked: boolean;
}

export function SpotlightProposalCard({
  proposal,
  currentEpoch,
  isTracked,
}: SpotlightProposalCardProps) {
  const reducedMotion = useReducedMotion();
  const immediate = !!reducedMotion;

  const theme = getProposalTheme(proposal.type ?? '');
  const verdict = getVerdict(proposal.status ?? 'open', proposal.triBody);
  const isOpen = proposal.status === 'open' || proposal.status === 'active';

  const isResolved = ['ratified', 'enacted', 'expired', 'dropped'].includes(
    (proposal.status ?? '').toLowerCase(),
  );

  // Urgency — only meaningful for open proposals
  const epochsRemaining =
    isOpen && proposal.expirationEpoch && currentEpoch
      ? proposal.expirationEpoch - currentEpoch
      : null;
  const isUrgent = epochsRemaining != null && epochsRemaining <= 1;

  // Status color
  const statusColors: Record<string, string> = {
    open: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    ratified: 'bg-primary/10 text-primary border-primary/20',
    enacted: 'bg-primary/10 text-primary border-primary/20',
    expired: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    dropped: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md">
      {isTracked && (
        <div className="absolute right-4 top-4 z-10">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
      )}

      {/* Type color accent */}
      <div className="h-1 w-full" style={{ backgroundColor: theme.accent }} />

      <div className="flex flex-col gap-5 p-6 sm:p-8">
        {/* Header: Type + Status + Urgency */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium',
              theme.browseBadgeClass,
            )}
          >
            {theme.label}
          </span>

          {proposal.status && (
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
                statusColors[proposal.status] ?? statusColors.open,
              )}
            >
              {proposal.status}
            </span>
          )}

          {isResolved ? (
            /* Outcome badge for decided proposals — no epoch countdown */
            <OutcomeBadge
              status={proposal.status ?? ''}
              expirationEpoch={proposal.expirationEpoch}
            />
          ) : (
            <>
              {isUrgent && (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {epochsRemaining === 0 ? 'Last epoch!' : `${epochsRemaining} epoch left`}
                </span>
              )}
              {epochsRemaining != null && !isUrgent && epochsRemaining > 0 && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {epochsRemaining} epochs remaining
                </span>
              )}
            </>
          )}
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold leading-snug sm:text-xl">
          {proposal.title || `Proposal ${proposal.txHash.slice(0, 8)}...#${proposal.index}`}
        </h2>

        {/* Treasury Amount */}
        {proposal.withdrawalAmount != null && proposal.withdrawalAmount > 0 && (
          <motion.div
            className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2.5"
            variants={immediate ? undefined : fadeIn}
            initial={immediate ? undefined : 'hidden'}
            animate="visible"
            transition={immediate ? undefined : { delay: 0.3 }}
          >
            <Landmark className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">
              <AnimatedScore
                value={Math.round(proposal.withdrawalAmount / 1_000_000)}
                duration={600}
                immediate={immediate}
              />
              M ADA
            </span>
            {proposal.treasuryPct != null && (
              <span className="text-xs text-muted-foreground">
                ({proposal.treasuryPct.toFixed(1)}% of treasury)
              </span>
            )}
          </motion.div>
        )}

        {/* Vote Bars */}
        {proposal.triBody && isOpen && (
          <motion.div
            className="space-y-3"
            variants={immediate ? undefined : fadeIn}
            initial={immediate ? undefined : 'hidden'}
            animate="visible"
            transition={immediate ? undefined : { delay: 0.4 }}
          >
            <VoteBar
              label="DReps"
              yes={proposal.triBody.drep.yes}
              no={proposal.triBody.drep.no}
              abstain={proposal.triBody.drep.abstain}
              delay={0.5}
              immediate={immediate}
            />
            <VoteBar
              label="Stake Pools"
              yes={proposal.triBody.spo.yes}
              no={proposal.triBody.spo.no}
              abstain={proposal.triBody.spo.abstain}
              delay={0.6}
              immediate={immediate}
            />
            <VoteBar
              label="Committee"
              yes={proposal.triBody.cc.yes}
              no={proposal.triBody.cc.no}
              abstain={proposal.triBody.cc.abstain}
              delay={0.7}
              immediate={immediate}
            />
          </motion.div>
        )}

        {/* Verdict */}
        {verdict && (
          <motion.div
            className="text-sm font-medium"
            variants={immediate ? undefined : fadeIn}
            initial={immediate ? undefined : 'hidden'}
            animate="visible"
            transition={immediate ? undefined : { delay: 0.8 }}
          >
            <span
              className={cn(
                'rounded-full border px-3 py-1',
                verdict.type === 'passing' || verdict.type === 'passed'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : verdict.type === 'failing' || verdict.type === 'rejected'
                    ? 'border-red-500/20 bg-red-500/10 text-red-400'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-400',
              )}
            >
              {verdict.label}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
