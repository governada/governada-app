'use client';

import Link from 'next/link';
import { Vote, MessageSquareHeart, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSegment, type UserSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { useGovernanceHolder, useDRepVotes } from '@/hooks/queries';
import { useSentimentResults } from '@/hooks/useEngagement';
import { ForceBeam } from './ForceBeam';
import { getProposalTheme } from './proposal-theme';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { computeTier } from '@/lib/scoring/tiers';
import {
  CITIZEN_PROPOSAL_ACTION_ID,
  getProposalConnectHref,
  getProposalGovernanceActionState,
  getProposalWorkspaceReviewHref,
} from '@/lib/navigation/proposalAction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposalVerdictStripProps {
  title: string;
  proposalType: string;
  status: string;
  isOpen: boolean;
  editorialHeadline: string;
  verdictLabel: string;
  verdictColor: string;
  verdictBg: string;
  yesPct: number;
  noPct: number;
  totalVoters: number;
  expirationEpoch: number | null;
  currentEpoch: number;
  withdrawalAmount: number | null;
  treasuryBalanceAda: number | null;
  blockTime: number | null;
  txHash: string;
  proposalIndex: number;
  /** Threshold progress (0-100 scale) — if available, renders a micro progress bar */
  thresholdPct?: number | null;
  /** Current Yes% of active stake — for the threshold bar */
  currentYesPct?: number | null;
  paramChanges?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTreasuryCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return amount.toLocaleString();
}

// ---------------------------------------------------------------------------
// Your Angle — persona-adapted context line
// ---------------------------------------------------------------------------

function YourAngle({ txHash, proposalIndex }: { txHash: string; proposalIndex: number }) {
  const { segment, stakeAddress, delegatedDrep } = useSegment();
  const { delegatedDrepId } = useWallet();

  const hasDrep =
    !!delegatedDrep &&
    delegatedDrep !== 'drep_always_abstain' &&
    delegatedDrep !== 'drep_always_no_confidence';

  // DRep data for citizens
  const { data: holderRaw } = useGovernanceHolder(
    segment === 'citizen' && hasDrep ? stakeAddress : null,
  );
  const { data: votesData } = useDRepVotes(
    segment === 'citizen' && hasDrep ? delegatedDrepId : null,
  );

  // Citizen sentiment data
  const { data: sentimentData } = useSentimentResults(txHash, proposalIndex);

  const drepVote = useMemo(() => {
    const vData = votesData as Record<string, unknown> | undefined;
    const votes = vData?.votes as Record<string, unknown>[] | undefined;
    if (!votes) return null;
    const match = votes.find(
      (v) => v.proposalTxHash === txHash && v.proposalIndex === proposalIndex,
    );
    return (match?.vote as string) || null;
  }, [votesData, txHash, proposalIndex]);

  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || null;
  const drepScore = (drep?.score as number) ?? 0;

  // Citizen sentiment summary
  const community = sentimentData?.community as
    | { support: number; oppose: number; unsure: number; total: number }
    | undefined;
  const supportPct =
    community && community.total > 0
      ? Math.round((community.support / community.total) * 100)
      : null;

  const parts: React.ReactNode[] = [];

  // Citizen with DRep
  if (segment === 'citizen' && hasDrep && drepName) {
    const tier = computeTier(drepScore);
    const voteLabel =
      drepVote === 'Yes'
        ? 'voted Yes'
        : drepVote === 'No'
          ? 'voted No'
          : drepVote === 'Abstain'
            ? 'abstained'
            : "hasn't voted yet";
    const voteColor =
      drepVote === 'Yes'
        ? 'text-emerald-400'
        : drepVote === 'No'
          ? 'text-red-400'
          : 'text-muted-foreground';

    parts.push(
      <span key="drep">
        Your DRep{' '}
        <Link
          href={`/drep/${encodeURIComponent(delegatedDrepId!)}`}
          className="font-medium hover:text-primary transition-colors"
        >
          {drepName}
        </Link>
        <span className="text-muted-foreground/60 mx-1">{tier}</span>
        <span className={cn('font-medium', voteColor)}>{voteLabel}</span>
      </span>,
    );
  }

  // Citizen without DRep
  if (segment === 'citizen' && !hasDrep) {
    parts.push(
      <span key="no-drep" className="text-muted-foreground">
        You haven&apos;t delegated yet &mdash;{' '}
        <Link href="/match" className="text-primary hover:underline">
          find your DRep
        </Link>
      </span>,
    );
  }

  // DRep angle
  if (segment === 'drep' || segment === 'spo' || segment === 'cc') {
    if (supportPct != null && community && community.total > 0) {
      parts.push(
        <span key="citizen-pulse">
          Citizen pulse: <span className="font-medium">{supportPct}% support</span>
          <span className="text-muted-foreground/60 mx-1">&middot;</span>
          {community.total} signal{community.total !== 1 ? 's' : ''}
        </span>,
      );
    }
  }

  // Citizen sentiment for citizens too
  if (segment === 'citizen' && supportPct != null && community && community.total > 2) {
    parts.push(
      <span key="sentiment">
        <span className="text-muted-foreground/60 mx-1">&middot;</span>
        {supportPct}% of citizens support
      </span>,
    );
  }

  // Anonymous teaser
  if (segment === 'anonymous' && parts.length === 0) {
    parts.push(
      <span key="anon" className="text-muted-foreground">
        Connect your wallet to see how your representative voted
      </span>,
    );
  }

  if (parts.length === 0) return null;

  return (
    <div className="text-xs text-foreground/70 flex items-center flex-wrap gap-x-0.5">{parts}</div>
  );
}

// ---------------------------------------------------------------------------
// Action Button
// ---------------------------------------------------------------------------

function ActionButton({
  segment,
  isOpen,
  txHash,
  proposalIndex,
  proposalType,
  paramChanges,
}: {
  segment: UserSegment;
  isOpen: boolean;
  txHash: string;
  proposalIndex: number;
  proposalType: string;
  paramChanges?: Record<string, unknown> | null;
}) {
  if (!isOpen) return null;
  const actionState = getProposalGovernanceActionState(segment, isOpen, proposalType, paramChanges);

  if (actionState.isGovernanceActor) {
    if (!actionState.canVote) return null;
    return (
      <Button asChild size="sm" className="gap-1.5 shrink-0">
        <Link href={getProposalWorkspaceReviewHref(txHash, proposalIndex)}>
          <Vote className="h-3.5 w-3.5" />
          Review &amp; Vote
        </Link>
      </Button>
    );
  }

  if (segment === 'citizen') {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 shrink-0"
        onClick={() => {
          const el = document.getElementById(CITIZEN_PROPOSAL_ACTION_ID);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        <MessageSquareHeart className="h-3.5 w-3.5" />
        Signal
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className="gap-1.5 shrink-0" asChild>
      <Link href={getProposalConnectHref(txHash, proposalIndex)}>
        <Wallet className="h-3.5 w-3.5" />
        Connect
      </Link>
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Metadata Pills
// ---------------------------------------------------------------------------

function MetadataPills({
  proposalType,
  status,
  expirationEpoch,
  currentEpoch,
  withdrawalAmount,
  treasuryBalanceAda,
  blockTime,
}: {
  proposalType: string;
  status: string;
  expirationEpoch: number | null;
  currentEpoch: number;
  withdrawalAmount: number | null;
  treasuryBalanceAda: number | null;
  blockTime: number | null;
}) {
  const theme = getProposalTheme(proposalType);
  const TypeIcon = theme.icon;
  const isOpen = status === 'open';
  const remaining =
    isOpen && expirationEpoch != null ? Math.max(0, expirationEpoch - currentEpoch) : null;

  const date = blockTime
    ? new Date(blockTime * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Type pill */}
      <Badge variant="outline" className={cn('gap-1 text-[10px] font-medium', theme.badgeClass)}>
        <TypeIcon className="h-3 w-3" />
        {theme.label}
      </Badge>

      {/* Deadline pill */}
      {isOpen && remaining != null && remaining > 0 && (
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] tabular-nums',
            remaining <= 2
              ? 'text-red-400 border-red-400/30'
              : 'text-muted-foreground border-border/50',
          )}
        >
          {remaining} epoch{remaining !== 1 ? 's' : ''} left
        </Badge>
      )}

      {/* Closed status */}
      {!isOpen && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50">
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      )}

      {/* Treasury amount pill */}
      {withdrawalAmount != null && withdrawalAmount > 0 && (
        <Badge
          variant="outline"
          className="text-[10px] tabular-nums font-medium text-amber-400 border-amber-400/30"
        >
          &#x20B3; {formatTreasuryCompact(withdrawalAmount / 1_000_000)} ADA
          {treasuryBalanceAda != null &&
            treasuryBalanceAda > 0 &&
            ` · ${((withdrawalAmount / 1_000_000 / treasuryBalanceAda) * 100).toFixed(1)}%`}
        </Badge>
      )}

      {/* Date */}
      {date && <span className="text-[10px] text-muted-foreground hidden md:inline">{date}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ProposalVerdictStrip({
  title,
  proposalType,
  status,
  isOpen,
  editorialHeadline,
  verdictLabel,
  verdictColor,
  verdictBg,
  yesPct,
  noPct,
  totalVoters,
  expirationEpoch,
  currentEpoch,
  withdrawalAmount,
  treasuryBalanceAda,
  blockTime,
  txHash,
  proposalIndex,
  thresholdPct,
  currentYesPct,
  paramChanges,
}: ProposalVerdictStripProps) {
  const { segment } = useSegment();

  return (
    <div className="space-y-3">
      {/* Title — dominant element, standalone */}
      <h1 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h1>

      {/* Metadata pills row */}
      <MetadataPills
        proposalType={proposalType}
        status={status}
        expirationEpoch={expirationEpoch}
        currentEpoch={currentEpoch}
        withdrawalAmount={withdrawalAmount}
        treasuryBalanceAda={treasuryBalanceAda}
        blockTime={blockTime}
      />

      {/* Verdict Strip — the unified card */}
      <div
        className={cn(
          'rounded-xl border overflow-hidden transition-colors',
          verdictBg,
          verdictColor === 'text-emerald-400'
            ? 'border-emerald-500/20'
            : verdictColor === 'text-red-400'
              ? 'border-red-500/20'
              : verdictColor === 'text-amber-400'
                ? 'border-amber-500/20'
                : 'border-border/50',
        )}
      >
        <div className="px-4 sm:px-5 py-4 space-y-3">
          {/* Row 1: Verdict + Action button */}
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-lg sm:text-xl font-bold', verdictColor)}>
                  {verdictLabel}
                </span>
                {totalVoters > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {totalVoters} voter{totalVoters !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <ActionButton
              segment={segment}
              isOpen={isOpen}
              txHash={txHash}
              proposalIndex={proposalIndex}
              proposalType={proposalType}
              paramChanges={paramChanges}
            />
          </div>

          {/* Row 2: Editorial headline */}
          <p className="text-sm text-foreground/80 leading-relaxed">{editorialHeadline}</p>

          {/* Row 3: Force beam + vote percentages */}
          {totalVoters > 0 && (
            <div className="space-y-1">
              <ForceBeam yesPct={yesPct} noPct={noPct} compact />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>
                  <span className="text-red-400 font-medium">{Math.round(noPct)}%</span> No
                </span>
                <span>
                  Yes <span className="text-emerald-400 font-medium">{Math.round(yesPct)}%</span>
                </span>
              </div>
            </div>
          )}

          {/* Row 4: Threshold micro-indicator (when available) */}
          {isOpen && thresholdPct != null && currentYesPct != null && totalVoters > 0 && (
            <div className="space-y-1">
              <div className="relative h-1.5 rounded-full bg-muted/40 overflow-visible">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/80 transition-all duration-500"
                  style={{ width: `${Math.min(100, currentYesPct)}%` }}
                />
                <div
                  className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-foreground/40"
                  style={{ left: `${Math.min(100, thresholdPct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{currentYesPct.toFixed(1)}% of active stake voting Yes</span>
                <span>{Math.round(thresholdPct)}% needed</span>
              </div>
            </div>
          )}

          {/* Row 5: Your Angle */}
          <YourAngle txHash={txHash} proposalIndex={proposalIndex} />
        </div>
      </div>
    </div>
  );
}
