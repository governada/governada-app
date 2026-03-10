'use client';

import Link from 'next/link';
import { ArrowLeft, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useDashboardDelegatorTrends, useSPODelegatorTrends } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

/**
 * WorkspaceDelegatorsPage — Delegator summary for DReps and SPOs.
 *
 * JTBD: "Who trusts me, and is that changing?"
 * Current count, recent changes, voting power.
 */
export function WorkspaceDelegatorsPage() {
  const { segment, drepId, poolId } = useSegment();
  const isDRep = segment === 'drep';
  const isSPO = segment === 'spo';

  const { data: drepTrendsRaw, isLoading: drepLoading } = useDashboardDelegatorTrends(
    isDRep ? drepId : null,
  );
  const { data: spoTrendsRaw, isLoading: spoLoading } = useSPODelegatorTrends(
    isSPO ? poolId : null,
  );

  const isLoading = isDRep ? drepLoading : spoLoading;
  const trendsRaw = isDRep ? drepTrendsRaw : spoTrendsRaw;

  if (!isDRep && !isSPO) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">This page is for DReps and SPOs.</p>
        <Button asChild>
          <Link href="/">Back to Hub</Link>
        </Button>
      </div>
    );
  }

  const trends = trendsRaw as Record<string, unknown> | undefined;
  const currentCount = (trends?.currentCount as number) ?? (trends?.totalDelegators as number) ?? 0;
  const change = (trends?.change as number) ?? 0;
  const votingPower = (trends?.votingPower as number) ?? 0;
  const votingPowerAda = votingPower > 0 ? votingPower / 1_000_000 : 0;
  const recentChanges =
    (trends?.recentChanges as { type: string; epoch: number; count: number }[]) ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/workspace"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Delegators</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Current Delegators
                  </span>
                </div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {currentCount.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendIcon value={change} />
                <span className="tabular-nums font-medium">
                  {change >= 0 ? '+' : ''}
                  {change}
                </span>
              </div>
            </div>

            {votingPowerAda > 0 && (
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total Voting Power</p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {votingPowerAda >= 1_000_000
                    ? `${(votingPowerAda / 1_000_000).toFixed(1)}M`
                    : votingPowerAda >= 1_000
                      ? `${(votingPowerAda / 1_000).toFixed(0)}K`
                      : Math.round(votingPowerAda).toLocaleString()}{' '}
                  ADA
                </p>
              </div>
            )}
          </div>

          {/* Recent changes */}
          {recentChanges.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Recent Changes
              </h3>
              {recentChanges.slice(0, 5).map((change, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <span className="text-sm text-foreground">Epoch {change.epoch}</span>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      change.count > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : change.count < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {change.count > 0 ? '+' : ''}
                    {change.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
