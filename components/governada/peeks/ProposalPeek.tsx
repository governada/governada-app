'use client';

/**
 * ProposalPeek — summary content for the peek drawer.
 *
 * Shows: title, status badge, vote power bars (Yes/No/Abstain),
 * time remaining, your DRep's vote, and "Open full" link.
 */

import Link from 'next/link';
import { Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';
import { getProposalTheme, getVerdict } from '@/components/governada/proposals/proposal-theme';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import type { VotesResponseData, VoteItem } from '@/types/api';
import { useMemo } from 'react';

interface ProposalPeekProps {
  txHash: string;
  index: number;
}

function VoteBar({
  label,
  data,
}: {
  label: string;
  data: { yes: number; no: number; abstain: number };
}) {
  const total = data.yes + data.no + data.abstain;
  if (total === 0) return null;
  const yesPct = (data.yes / total) * 100;
  const noPct = (data.no / total) * 100;
  const abstainPct = (data.abstain / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{total.toLocaleString()} votes</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
        {yesPct > 0 && (
          <div
            className="bg-emerald-500/90 transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          />
        )}
        {noPct > 0 && (
          <div
            className="bg-red-500/80 transition-all duration-500"
            style={{ width: `${noPct}%` }}
          />
        )}
        {abstainPct > 0 && (
          <div
            className="bg-amber-500/60 transition-all duration-500"
            style={{ width: `${abstainPct}%` }}
          />
        )}
      </div>
      <div className="flex gap-3 text-[10px] tabular-nums">
        <span className="text-emerald-400">Yes {Math.round(yesPct)}%</span>
        <span className="text-red-400">No {Math.round(noPct)}%</span>
        <span className="text-amber-400">Abstain {Math.round(abstainPct)}%</span>
      </div>
    </div>
  );
}

const VOTE_PILL: Record<string, { label: string; cls: string }> = {
  Yes: { label: 'Yes', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  No: { label: 'No', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  Abstain: { label: 'Abstain', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

export function ProposalPeek({ txHash, index }: ProposalPeekProps) {
  const { data: rawData, isLoading } = useProposals(200);
  const data = rawData as { proposals?: BrowseProposal[]; currentEpoch?: number } | undefined;
  const { delegatedDrepId } = useWallet();
  const { data: drepVotesRaw } = useDRepVotes(delegatedDrepId);

  const proposal = useMemo(() => {
    const proposals = data?.proposals ?? [];
    return proposals.find((p) => p.txHash === txHash && p.index === index);
  }, [data, txHash, index]);

  const drepVote = useMemo(() => {
    const votesData = drepVotesRaw as VotesResponseData | undefined;
    const votes = votesData?.votes ?? (drepVotesRaw as VoteItem[] | undefined);
    if (!Array.isArray(votes)) return undefined;
    const match = votes.find((v) => v.proposalTxHash === txHash && v.proposalIndex === index);
    return match ? (match.vote ?? match.voteDirection) : undefined;
  }, [drepVotesRaw, txHash, index]);

  if (isLoading || !proposal) {
    return (
      <div className="space-y-4 pt-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    );
  }

  const status = proposal.status ?? 'Open';
  const statusLower = status.toLowerCase();
  const isOpen = statusLower === 'open';
  const theme = proposal.type ? getProposalTheme(proposal.type) : null;
  const TypeIcon = theme?.icon;
  const verdict = getVerdict(statusLower, proposal.triBody);
  const currentEpoch = data?.currentEpoch;
  const epochsLeft =
    isOpen && currentEpoch && proposal.expirationEpoch
      ? proposal.expirationEpoch - currentEpoch
      : null;
  const isUrgent = epochsLeft != null && epochsLeft <= 2;
  const pill = drepVote ? VOTE_PILL[drepVote] : null;

  const title = proposal.title || `${txHash.slice(0, 16)}...`;
  const href = `/proposal/${txHash}/${index}`;

  return (
    <div className="space-y-4 pt-1">
      {/* Type + status */}
      <div className="flex items-center gap-2 flex-wrap">
        {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0" style={{ color: theme?.accent }} />}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {theme?.label ?? 'Governance Action'}
        </span>
        <span
          className={cn(
            'text-[11px] font-semibold px-2 py-0.5 rounded-full border ml-auto',
            verdict.color,
            verdict.bgColor,
            verdict.borderColor,
          )}
        >
          {verdict.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold leading-snug">{title}</h3>

      {/* Time remaining */}
      {epochsLeft != null && epochsLeft > 0 && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs',
            isUrgent ? 'text-amber-400 font-semibold' : 'text-muted-foreground',
          )}
        >
          {isUrgent ? (
            <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {epochsLeft === 1 ? 'Last epoch!' : `${epochsLeft} epochs remaining`}
        </div>
      )}

      {/* Vote bars */}
      {proposal.triBody && (
        <div className="space-y-3 rounded-lg border border-border/30 bg-muted/10 p-3">
          <VoteBar label="DRep" data={proposal.triBody.drep} />
          <VoteBar label="SPO" data={proposal.triBody.spo} />
          <VoteBar label="CC" data={proposal.triBody.cc} />
        </div>
      )}

      {/* Your DRep's vote */}
      {pill && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Your DRep voted:</span>
          <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', pill.cls)}>
            {pill.label}
          </span>
        </div>
      )}

      {/* Open full link */}
      <Link
        href={href}
        className={cn(
          'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg',
          'text-sm font-medium transition-colors',
          'bg-primary/10 text-primary hover:bg-primary/20',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
      >
        Open full details
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
