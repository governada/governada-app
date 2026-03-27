'use client';

/**
 * ProposalGlobePanel — Proposal detail for the globe panel overlay.
 *
 * Enhanced version of ProposalPeek. Links to voter DReps navigate within /g/.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useProposals, useDRepVotes } from '@/hooks/queries';
import { useWallet } from '@/utils/wallet-context';
import { getProposalTheme, getVerdict } from '@/components/governada/proposals/proposal-theme';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import { TreasuryImpactChip } from '@/components/governada/shared/TreasuryImpactChip';
import { TreasuryImpactWidget } from '@/components/workspace/review/TreasuryImpactWidget';
import { useTreasuryContext } from '@/hooks/useTreasuryContext';
import type { VotesResponseData, VoteItem } from '@/types/api';
import { VoteBar } from './panelShared';

interface ProposalGlobePanelProps {
  txHash: string;
  index: number;
}

const VOTE_PILL: Record<string, { label: string; cls: string }> = {
  Yes: { label: 'Yes', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  No: { label: 'No', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
  Abstain: { label: 'Abstain', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

export function ProposalGlobePanel({ txHash, index }: ProposalGlobePanelProps) {
  const { data: rawData, isLoading } = useProposals(200);
  const data = rawData as { proposals?: BrowseProposal[]; currentEpoch?: number } | undefined;
  const { delegatedDrepId } = useWallet();
  const { data: drepVotesRaw } = useDRepVotes(delegatedDrepId);
  const { data: treasuryCtx } = useTreasuryContext();

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
    return <PanelSkeleton />;
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

  return (
    <div className="space-y-5">
      {/* Type + status header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0" style={{ color: theme?.accent }} />}
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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

        <h3 className="text-lg font-semibold leading-snug">{title}</h3>

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
      </div>

      {/* Tri-body vote bars */}
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
          {delegatedDrepId && (
            <Link
              href={`/g/drep/${delegatedDrepId}`}
              className="text-[10px] text-primary hover:underline ml-auto"
            >
              View DRep
            </Link>
          )}
        </div>
      )}

      {/* Treasury impact */}
      {proposal.type === 'TreasuryWithdrawals' &&
        proposal.withdrawalAmount != null &&
        proposal.withdrawalAmount > 0 && (
          <div className="space-y-3">
            {treasuryCtx && treasuryCtx.burnRatePerEpoch > 0 && (
              <TreasuryImpactChip
                withdrawalAda={proposal.withdrawalAmount}
                burnRatePerEpoch={treasuryCtx.burnRatePerEpoch}
                runwayMonths={treasuryCtx.runwayMonths}
                size="md"
              />
            )}
            <TreasuryImpactWidget
              withdrawalAmount={proposal.withdrawalAmount * 1_000_000}
              proposalType={proposal.type}
            />
          </div>
        )}

      {/* Open full link */}
      <Link
        href={`/proposal/${txHash}/${index}`}
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

function PanelSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
