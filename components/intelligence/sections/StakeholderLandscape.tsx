'use client';

/**
 * StakeholderLandscape — inter-body votes + citizen sentiment for review brief.
 *
 * Wraps the same VoteBar pattern from IntelPanel's CommunitySentimentCard.
 */

import { cn } from '@/lib/utils';
import { getVotingBodies } from '@/lib/governance/votingBodies';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StakeholderLandscapeProps {
  interBodyVotes?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
  citizenSentiment?: {
    support: number;
    oppose: number;
    abstain: number;
    total: number;
  } | null;
  proposalType: string;
  paramChanges?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// VoteBar (same pattern as IntelPanel)
// ---------------------------------------------------------------------------

function VoteBar({
  label,
  yes,
  no,
  abstain,
}: {
  label: string;
  yes: number;
  no: number;
  abstain: number;
}) {
  const total = yes + no + abstain;
  if (total === 0) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="h-2 rounded-full bg-muted/30" />
        <span className="text-[10px] text-muted-foreground/60">No votes yet</span>
      </div>
    );
  }
  const yPct = (yes / total) * 100;
  const nPct = (no / total) * 100;
  const aPct = (abstain / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground/60 tabular-nums">
          {total} vote{total !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {yPct > 0 && (
          <div className="bg-emerald-500 transition-all" style={{ width: `${yPct}%` }} />
        )}
        {nPct > 0 && <div className="bg-red-500 transition-all" style={{ width: `${nPct}%` }} />}
        {aPct > 0 && <div className="bg-zinc-500 transition-all" style={{ width: `${aPct}%` }} />}
      </div>
      <div className="flex gap-3 text-[10px] tabular-nums">
        <span className="text-emerald-400">Yes {yes}</span>
        <span className="text-red-400">No {no}</span>
        <span className="text-zinc-400">Abstain {abstain}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StakeholderLandscape({
  interBodyVotes,
  citizenSentiment,
  proposalType,
  paramChanges,
}: StakeholderLandscapeProps) {
  const eligibleBodies = getVotingBodies(proposalType, paramChanges);

  return (
    <div className="space-y-3 text-xs">
      {/* Inter-body votes */}
      {interBodyVotes && (
        <div className="space-y-2">
          {eligibleBodies.includes('drep') && <VoteBar label="DRep" {...interBodyVotes.drep} />}
          {eligibleBodies.includes('spo') && <VoteBar label="SPO" {...interBodyVotes.spo} />}
          {eligibleBodies.includes('cc') && (
            <VoteBar label="Constitutional Committee" {...interBodyVotes.cc} />
          )}
        </div>
      )}

      {/* Citizen sentiment */}
      {citizenSentiment && citizenSentiment.total > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
            Citizen Sentiment
          </span>
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'font-medium tabular-nums',
                citizenSentiment.support / citizenSentiment.total >= 0.6
                  ? 'text-emerald-400'
                  : citizenSentiment.support / citizenSentiment.total >= 0.4
                    ? 'text-amber-400'
                    : 'text-red-400',
              )}
            >
              {Math.round((citizenSentiment.support / citizenSentiment.total) * 100)}% support
            </span>
            <span className="text-muted-foreground/60">
              ({citizenSentiment.total.toLocaleString()} citizen
              {citizenSentiment.total !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      )}

      {!interBodyVotes && !citizenSentiment && (
        <p className="text-muted-foreground/60 py-1">No voting data available yet</p>
      )}
    </div>
  );
}
