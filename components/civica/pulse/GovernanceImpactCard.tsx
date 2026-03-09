'use client';

import Link from 'next/link';
import { Shield, Vote, DollarSign, ChevronRight, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useWallet } from '@/utils/wallet-context';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDRepReportCard, useAccountInfo, useEpochSummary } from '@/hooks/queries';
import { computeTier } from '@/lib/scoring/tiers';

interface GovernanceImpactCardProps {
  /** Total ADA under DRep governance in lovelace (from pulse API) */
  totalAdaGovernedLovelace: number;
  /** Treasury balance in ADA (from treasury API) */
  treasuryBalanceAda: number;
}

const TIER_BADGE: Record<string, string> = {
  Emerging: 'bg-muted text-muted-foreground',
  Bronze: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  Silver: 'bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300',
  Gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400',
  Diamond: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300',
  Legendary: 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
};

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000).toLocaleString()}K`;
  return Math.round(ada).toLocaleString();
}

function formatPct(pct: number): string {
  if (pct < 0.0001) return '<0.0001%';
  if (pct < 0.01) return `${pct.toFixed(4)}%`;
  if (pct < 1) return `${pct.toFixed(3)}%`;
  return `${pct.toFixed(2)}%`;
}

/**
 * Personalized "Your Governance Impact" card for the Pulse page.
 * Only renders when wallet is connected.
 * Shows a delegation CTA if connected but not delegated.
 */
export function GovernanceImpactCard({
  totalAdaGovernedLovelace,
  treasuryBalanceAda,
}: GovernanceImpactCardProps) {
  const { connected, delegatedDrepId } = useWallet();
  const { stakeAddress, delegatedDrep } = useSegment();

  // The wallet may provide delegatedDrepId before segment resolves
  const effectiveDrepId = delegatedDrepId || delegatedDrep;

  const { data: reportCard, isLoading: reportCardLoading } = useDRepReportCard(effectiveDrepId);
  const { data: accountInfo, isLoading: accountLoading } = useAccountInfo(stakeAddress);
  const walletAddress = stakeAddress ?? undefined;
  const { data: epochSummary } = useEpochSummary(walletAddress);

  // No-wallet preview: blurred mock stats create FOMO
  if (!connected) {
    return (
      <div className="relative rounded-xl border border-border bg-card p-4 overflow-hidden">
        <div className="absolute inset-0 backdrop-blur-sm bg-card/60 z-10 flex flex-col items-center justify-center gap-2">
          <Shield className="h-5 w-5 text-primary" aria-hidden />
          <p className="text-sm font-medium">Your Governance This Epoch</p>
          <p className="text-xs text-muted-foreground text-center max-w-[200px]">
            Connect your wallet to see how your DRep represents you
          </p>
        </div>
        <div className="opacity-30 pointer-events-none select-none" aria-hidden="true">
          <div className="grid grid-cols-3 gap-4 py-2">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Voting Power</span>
              <span className="text-lg font-semibold block">{'\u2588\u2588'} ADA</span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Your DRep</span>
              <span className="text-lg font-semibold block">
                {'\u2588\u2588\u2588\u2588\u2588\u2588'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">Proposals Voted</span>
              <span className="text-lg font-semibold block">{'\u2588\u2588'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected but no delegation — show CTA with ADA balance
  if (!effectiveDrepId) {
    const balanceAda = accountInfo?.totalBalanceAda
      ? Math.round(Number(accountInfo.totalBalanceAda))
      : null;

    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
            Your Governance Impact
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {balanceAda
            ? `You hold ${balanceAda.toLocaleString()} ADA but aren't represented in governance.`
            : `You're connected but not yet represented in governance.`}
        </p>
        <Link
          href="/match"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Find your DRep match <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const isLoading = reportCardLoading || accountLoading;

  // Cast report card to expected shape
  const rc = reportCard as
    | {
        name?: string | null;
        score?: number;
        tier?: string;
        participationRate?: number | null;
        drepId?: string;
        scoreHistory?: { snapshot_date: string; score: number }[];
      }
    | undefined;

  const es = epochSummary as
    | {
        drep_votes_cast: number;
        proposals_voted_on: number;
        drep_score_at_epoch: number | null;
        drep_tier_at_epoch: string | null;
      }
    | undefined;

  // Score trajectory from report card history
  const scoreHistory = rc?.scoreHistory ?? [];
  const currentScore =
    scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1]?.score : null;
  const prevScore = scoreHistory.length > 1 ? scoreHistory[scoreHistory.length - 2]?.score : null;
  const scoreDelta =
    currentScore != null && prevScore != null ? Math.round(currentScore - prevScore) : null;

  const userAda = accountInfo?.totalBalanceAda ?? 0;
  const totalGovernedAda = totalAdaGovernedLovelace / 1_000_000;
  const governancePct = totalGovernedAda > 0 ? (userAda / totalGovernedAda) * 100 : 0;
  const treasuryShare = treasuryBalanceAda > 0 ? (governancePct / 100) * treasuryBalanceAda : 0;

  const tier = rc?.tier ?? (rc?.score != null ? computeTier(rc.score) : 'Emerging');
  const tierBadge = TIER_BADGE[tier] ?? TIER_BADGE.Emerging;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-2 w-32" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-2 w-28" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-2 w-36" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/[0.03] to-transparent p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" aria-hidden />
        <p className="text-xs font-semibold text-primary uppercase tracking-wider">
          Your Governance Impact
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Voting Power */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Vote className="h-3 w-3 text-muted-foreground" aria-hidden />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Your Voting Power
            </p>
          </div>
          <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
            {'\u20B3'}
            {formatAda(userAda)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatPct(governancePct)} of governance
          </p>
        </div>

        {/* Your DRep */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-3 w-3 text-muted-foreground" aria-hidden />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Your DRep
            </p>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              href={`/drep/${effectiveDrepId}`}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate leading-tight"
              title={rc?.name ?? effectiveDrepId}
            >
              {rc?.name ?? `${effectiveDrepId.slice(0, 8)}...${effectiveDrepId.slice(-4)}`}
            </Link>
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0',
                tierBadge,
              )}
            >
              {tier}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {rc?.participationRate != null
              ? `${Math.round(rc.participationRate)}% participation`
              : 'Loading...'}
          </p>
        </div>

        {/* Treasury Share */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-muted-foreground" aria-hidden />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              Your Treasury Share
            </p>
          </div>
          <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
            {'\u20B3'}
            {formatAda(treasuryShare)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Proportional share of {'\u20B3'}
            {formatAda(treasuryBalanceAda)} treasury
          </p>
        </div>
      </div>

      {/* DRep activity this epoch */}
      {es && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              This Epoch
            </h4>
            {scoreDelta != null && scoreDelta !== 0 && (
              <span
                className={cn(
                  'text-xs font-medium',
                  scoreDelta > 0
                    ? 'text-emerald-500'
                    : scoreDelta < 0
                      ? 'text-rose-500'
                      : 'text-muted-foreground',
                )}
              >
                Score: {prevScore} {'\u2192'} {currentScore} ({scoreDelta > 0 ? '+' : ''}
                {scoreDelta})
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Your DRep voted on <strong>{es.drep_votes_cast}</strong> of{' '}
            <strong>{es.proposals_voted_on}</strong> proposals
            {es.drep_votes_cast > 0 && es.proposals_voted_on > 0 && (
              <>
                {' '}
                &mdash;{' '}
                <strong>
                  {Math.round((es.drep_votes_cast / es.proposals_voted_on) * 100)}%
                </strong>{' '}
                participation
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
