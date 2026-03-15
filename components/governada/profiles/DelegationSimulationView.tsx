'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Vote, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { DelegationSimulation, SimulatedVote } from '@/lib/matching/delegationSimulation';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';

/* ─── Types ───────────────────────────────────────────── */

interface DelegationSimulationViewProps {
  simulation: DelegationSimulation;
  className?: string;
}

/* ─── Vote outcome styling ────────────────────────────── */

const OUTCOME_BADGE: Record<string, { className: string; icon: typeof CheckCircle2 }> = {
  Enacted: {
    className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: CheckCircle2,
  },
  Expired: {
    className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    icon: XCircle,
  },
  Dropped: {
    className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    icon: XCircle,
  },
  Pending: {
    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: Clock,
  },
};

const VOTE_BADGE: Record<string, string> = {
  Yes: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  No: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
  Abstain: 'bg-muted text-muted-foreground border-border',
};

const ALIGNMENT_INDICATOR: Record<string, { label: string; className: string }> = {
  agree: { label: 'Aligned', className: 'text-emerald-600 dark:text-emerald-400' },
  disagree: { label: 'Differs', className: 'text-amber-600 dark:text-amber-400' },
  neutral: { label: 'Neutral', className: 'text-muted-foreground' },
};

/* ─── Single vote row ────────────────────────────────── */

function SimulatedVoteRow({ vote }: { vote: SimulatedVote }) {
  const outcome = OUTCOME_BADGE[vote.outcome] ?? OUTCOME_BADGE.Pending;
  const OutcomeIcon = outcome.icon;
  const voteBadge = VOTE_BADGE[vote.drepVote] ?? VOTE_BADGE.Abstain;
  const alignmentInfo = vote.alignmentWithUser ? ALIGNMENT_INDICATOR[vote.alignmentWithUser] : null;

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/30 last:border-b-0">
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-xs font-medium text-foreground truncate">{vote.proposalTitle}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', voteBadge)}>
            {vote.drepVote}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', outcome.className)}>
            <OutcomeIcon className="h-2.5 w-2.5 mr-0.5" />
            {vote.outcome}
          </Badge>
          {vote.deliveryStatus && vote.deliveryStatus !== 'in_progress' && (
            <span className="text-[10px] text-muted-foreground">
              {vote.deliveryStatus === 'delivered'
                ? 'Delivered'
                : vote.deliveryStatus === 'partial'
                  ? 'Partial'
                  : 'Not delivered'}
            </span>
          )}
          {alignmentInfo && (
            <span className={cn('text-[10px] font-medium', alignmentInfo.className)}>
              {alignmentInfo.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────── */

export function DelegationSimulationView({ simulation, className }: DelegationSimulationViewProps) {
  const [expanded, setExpanded] = useState(false);
  const { isAtLeast } = useGovernanceDepth();

  // Deep depth shows full list, engaged shows summary only
  const showFullList = isAtLeast('deep');

  const alignmentPct =
    simulation.totalClassifiedVotes > 0
      ? Math.round((simulation.alignedVoteCount / simulation.totalClassifiedVotes) * 100)
      : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-4',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Vote className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          If You Had Delegated
        </span>
      </div>

      {/* Period */}
      <p className="text-xs text-muted-foreground">{simulation.periodLabel}</p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">Proposals</p>
          <p className="text-lg font-bold tabular-nums">{simulation.totalProposals}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
          <p className="text-xs text-muted-foreground">DRep Voted</p>
          <p className="text-lg font-bold tabular-nums">
            {simulation.drepVotedOn}
            {simulation.totalProposals > 0 && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({Math.round((simulation.drepVotedOn / simulation.totalProposals) * 100)}%)
              </span>
            )}
          </p>
        </div>
        {alignmentPct !== null && (
          <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Aligned</p>
            <p className="text-lg font-bold tabular-nums">
              {simulation.alignedVoteCount}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({alignmentPct}%)
              </span>
            </p>
          </div>
        )}
        {simulation.enactedCount > 0 && (
          <div className="rounded-lg border border-border/50 bg-card/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">Enacted</p>
            <p className="text-lg font-bold tabular-nums">
              {simulation.enactedCount}
              {simulation.deliverySuccessRate !== null && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({simulation.deliverySuccessRate}% delivered)
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Delivery coverage note */}
      {simulation.deliveryCoverage && (
        <p className="text-[10px] text-muted-foreground">{simulation.deliveryCoverage}</p>
      )}

      {/* Expandable vote list — deep depth only */}
      {showFullList && simulation.simulatedVotes.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide proposals
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show all {simulation.simulatedVotes.length} proposals
              </>
            )}
          </Button>

          {expanded && (
            <div className="max-h-96 overflow-y-auto border border-border/30 rounded-lg px-3">
              {simulation.simulatedVotes.map((vote) => (
                <SimulatedVoteRow key={vote.proposalId} vote={vote} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
