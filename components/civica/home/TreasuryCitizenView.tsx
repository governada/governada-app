'use client';

import Link from 'next/link';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTreasuryCurrent, useTreasuryPending } from '@/hooks/queries';

function formatAdaCitizen(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B ADA`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(0)}M ADA`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K ADA`;
  return `${Math.round(ada)} ADA`;
}

function TreasurySkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export function TreasuryCitizenView({ className }: { className?: string }) {
  const { data: rawCurrent, isLoading: currentLoading } = useTreasuryCurrent();
  const { data: rawPending, isLoading: pendingLoading } = useTreasuryPending();

  const treasury = rawCurrent as any;
  const pending = rawPending as any;

  if (currentLoading) return <TreasurySkeleton />;
  if (!treasury) return null;

  const TrendIcon =
    treasury.trend === 'growing'
      ? TrendingUp
      : treasury.trend === 'shrinking'
        ? TrendingDown
        : Minus;

  const trendLabel =
    treasury.trend === 'growing'
      ? 'Growing'
      : treasury.trend === 'shrinking'
        ? 'Shrinking'
        : 'Stable';

  const trendColor =
    treasury.trend === 'growing'
      ? 'text-emerald-500'
      : treasury.trend === 'shrinking'
        ? 'text-rose-500'
        : 'text-muted-foreground';

  const pendingProposals: any[] = Array.isArray(pending?.proposals)
    ? pending.proposals.slice(0, 3)
    : [];

  return (
    <Card className={className}>
      <CardContent className="pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Where Your Money Goes</p>
          </div>
          <Link
            href="/pulse"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Full details
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Balance + Trend */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Cardano&apos;s shared treasury</p>
          <div className="flex items-end gap-3">
            <p className="font-display text-3xl font-bold tabular-nums text-foreground">
              {formatAdaCitizen(treasury.balance)}
            </p>
            <div className={cn('flex items-center gap-1 pb-0.5', trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{trendLabel}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Funded by protocol reserves and transaction fees. Spent through governance votes.
          </p>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p
              className={cn(
                'text-xl font-bold tabular-nums',
                (treasury.runwayMonths ?? 0) > 24 ? 'text-emerald-500' : 'text-amber-500',
              )}
            >
              {treasury.runwayMonths >= 999
                ? '10+ years'
                : treasury.runwayMonths != null
                  ? `${Math.round(treasury.runwayMonths / 12)} years`
                  : '--'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Runway at current rate
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3 text-center">
            <p
              className={cn(
                'text-xl font-bold tabular-nums',
                (treasury.pendingCount ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground',
              )}
            >
              {treasury.pendingCount ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Proposals requesting funds</p>
          </div>
        </div>

        {/* Pending withdrawal previews */}
        {!pendingLoading && pendingProposals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Awaiting decision</p>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
              {pendingProposals.map((item: any, idx: number) => (
                <Link
                  key={idx}
                  href={`/proposal/${item.txHash ?? item.tx_hash}/${item.index ?? 0}`}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">
                      {item.title ?? item.proposalType ?? 'Treasury withdrawal'}
                    </p>
                    {item.withdrawalAda != null && (
                      <p className="text-xs text-muted-foreground">
                        {formatAdaCitizen(item.withdrawalAda)}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
