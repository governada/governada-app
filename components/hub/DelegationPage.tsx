'use client';

import Link from 'next/link';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Server,
} from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceHolder } from '@/hooks/queries';
import { useSPOSummary } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function TrendArrow({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function DRepSection() {
  const { stakeAddress, delegatedDrep } = useSegment();
  const { data: holderRaw, isLoading } = useGovernanceHolder(stakeAddress);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Not delegated
  if (!delegatedDrep) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">No DRep Delegation</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your ADA is not represented in governance decisions. Delegate to a DRep to make your voice
          count.
        </p>
        <div className="flex gap-3">
          <Button asChild size="sm">
            <Link href="/match">
              Find a DRep <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/discover">Browse DReps</Link>
          </Button>
        </div>
      </div>
    );
  }

  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || 'Your DRep';
  const drepScore = Math.round((drep?.score as number) ?? 0);
  const isActive = (drep?.isActive as boolean) ?? true;
  const participationRate = Math.round((drep?.participationRate as number) ?? 0);
  const rationaleRate = Math.round((drep?.rationaleRate as number) ?? 0);
  const recentVotes = (drep?.recentVotes as number) ?? 0;
  const scoreChange = (drep?.scoreChange as number) ?? 0;

  const StatusIcon = isActive ? ShieldCheck : ShieldX;
  const statusColor = isActive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* DRep header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your DRep
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{drepName}</h2>
          <div className="flex items-center gap-2 text-sm">
            <StatusIcon className={`h-4 w-4 ${statusColor}`} />
            <span className={statusColor}>{isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold tabular-nums text-foreground">{drepScore}</span>
          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
            <TrendArrow value={scoreChange} />
            <span className="tabular-nums">
              {scoreChange >= 0 ? '+' : ''}
              {scoreChange.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{participationRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{rationaleRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Rationale Rate</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{recentVotes}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Recent Votes</p>
        </div>
      </div>

      {/* Link to full profile */}
      <Link
        href={`/drep/${encodeURIComponent(delegatedDrep)}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View full profile <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function PoolSection() {
  const { delegatedPool } = useSegment();
  const { data: poolRaw, isLoading } = useSPOSummary(delegatedPool);

  if (!delegatedPool) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Stake Pool
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          No stake pool detected. Your ADA may be staked to a pool without governance participation.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const pool = poolRaw as Record<string, unknown> | undefined;
  const poolName = (pool?.poolName as string) || (pool?.ticker as string) || 'Your Pool';
  const ticker = (pool?.ticker as string) ?? '';
  const govScore = Math.round((pool?.governanceScore as number) ?? 0);
  const voteCount = (pool?.voteCount as number) ?? 0;
  const participationRate = Math.round((pool?.participationRate as number) ?? 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Stake Pool
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {ticker ? `[${ticker}] ` : ''}
            {poolName}
          </h2>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-foreground">{govScore}</span>
          <p className="text-xs text-muted-foreground">Gov Score</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{voteCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Votes Cast</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{participationRate}%</p>
          <p className="text-xs text-muted-foreground mt-0.5">Participation</p>
        </div>
      </div>

      <Link
        href={`/pool/${encodeURIComponent(delegatedPool)}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View pool profile <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/**
 * DelegationPage — Governance coverage showing both representatives.
 *
 * JTBD: "Who represents my ADA in governance?"
 * Shows DRep + Pool side by side with key stats.
 * The page a citizen lands on from the RepresentationCard.
 */
export function DelegationPage() {
  const { segment } = useSegment();

  // Redirect anonymous users to discover
  if (segment === 'anonymous') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Connect Your Wallet</h1>
        <p className="text-muted-foreground">
          Connect your wallet to see who represents your ADA in governance.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href="/match">Find a DRep</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/discover">Browse Governance</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Your Governance Coverage</h1>
        <p className="text-sm text-muted-foreground">
          The representatives who vote on your behalf in Cardano governance.
        </p>
      </div>

      <DRepSection />
      <PoolSection />
    </div>
  );
}
