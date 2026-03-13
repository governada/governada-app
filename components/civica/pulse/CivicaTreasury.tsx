'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, DollarSign, Clock, ExternalLink } from 'lucide-react';
import { scaleLinear } from 'd3-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { cn } from '@/lib/utils';
import { GlowBar } from '@/components/ui/GlowBar';
import { useTreasuryCurrent, useTreasuryHistory, useTreasuryPending } from '@/hooks/queries';
import type { TreasuryData } from '@/types/api';

interface TreasuryHistoryData {
  snapshots?: { epoch: number; balanceAda: number; withdrawalsAda: number }[];
  [key: string]: unknown;
}

interface PendingData {
  items?: PendingItem[];
  [key: string]: unknown;
}

interface PendingItem {
  title?: string;
  proposalType?: string;
  amountAda?: number;
  txHash?: string;
  tx_hash?: string;
  index?: number;
  [key: string]: unknown;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `₳${(ada / 1_000_000_000).toFixed(2)}B`;
  if (ada >= 1_000_000) return `₳${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `₳${Math.round(ada / 1_000)}K`;
  return `₳${Math.round(ada)}`;
}

function BalanceSparkline({ snapshots }: { snapshots: { epoch: number; balanceAda: number }[] }) {
  if (snapshots.length < 2) return null;

  const W = 400;
  const H = 64;
  const PAD_X = 4;
  const PAD_Y = 4;

  const balances = snapshots.map((s) => s.balanceAda);
  const minB = Math.min(...balances);
  const maxB = Math.max(...balances);
  const range = maxB - minB || 1;

  const xScale = scaleLinear()
    .domain([0, snapshots.length - 1])
    .range([PAD_X, W - PAD_X]);
  const yScale = scaleLinear()
    .domain([minB - range * 0.1, maxB + range * 0.1])
    .range([H - PAD_Y, PAD_Y]);

  const linePts = snapshots
    .map((s, i) => `${xScale(i).toFixed(1)},${yScale(s.balanceAda).toFixed(1)}`)
    .join(' ');
  const areaBottom = H - PAD_Y;
  const areaPts = `${xScale(0).toFixed(1)},${areaBottom} ${linePts} ${xScale(snapshots.length - 1).toFixed(1)},${areaBottom}`;

  const isGrowing = balances[balances.length - 1] > balances[0];
  const lineColor = isGrowing ? '#34d399' : '#f87171';
  const fillColor = isGrowing ? '#34d39930' : '#f8717130';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: H }}
    >
      <polygon points={areaPts} fill={fillColor} />
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        points={linePts}
      />
    </svg>
  );
}

export function CivicaTreasury() {
  const {
    data: rawCurrent,
    isLoading: currentLoading,
    isError: currentError,
    refetch: refetchCurrent,
  } = useTreasuryCurrent();
  const {
    data: rawHistory,
    isLoading: historyLoading,
    isError: historyError,
    refetch: refetchHistory,
  } = useTreasuryHistory(30);
  const { data: rawPending, isLoading: pendingLoading } = useTreasuryPending();

  const treasury = rawCurrent as
    | (TreasuryData & {
        balance?: number;
        trend?: string;
        runwayMonths?: number;
        burnRatePerEpoch?: number;
        pendingCount?: number;
        healthScore?: number;
      })
    | undefined;
  const history = rawHistory as TreasuryHistoryData | undefined;
  const pending = rawPending as PendingData | PendingItem[] | undefined;

  const snapshots: { epoch: number; balanceAda: number; withdrawalsAda: number }[] = (
    history?.snapshots ?? []
  )
    .slice()
    .sort((a, b) => a.epoch - b.epoch);

  const pendingObj = pending as PendingData | undefined;
  const pendingItems: PendingItem[] = Array.isArray((pendingObj as PendingData | undefined)?.items)
    ? (pendingObj as PendingData).items!.slice(0, 5)
    : Array.isArray(pending)
      ? (pending as PendingItem[]).slice(0, 5)
      : [];

  const isLoading = currentLoading || historyLoading;
  const hasError = currentError || historyError;

  if (hasError) {
    return (
      <ErrorCard
        message="Unable to load treasury data."
        onRetry={() => {
          refetchCurrent();
          refetchHistory();
        }}
      />
    );
  }

  const trendIcon =
    treasury?.trend === 'growing'
      ? TrendingUp
      : treasury?.trend === 'shrinking'
        ? TrendingDown
        : Minus;
  const trendColor =
    treasury?.trend === 'growing'
      ? 'text-emerald-400'
      : treasury?.trend === 'shrinking'
        ? 'text-rose-400'
        : 'text-muted-foreground';
  const TrendIcon = trendIcon;

  return (
    <div className="space-y-6">
      {/* Balance + sparkline */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        <div className="p-5 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Treasury Balance
          </p>
          <div className="flex items-end gap-3">
            {isLoading ? (
              <Skeleton className="h-10 w-36" />
            ) : (
              <p className="font-display text-4xl font-bold leading-none">
                {treasury?.balance != null
                  ? formatAda(treasury.balance)
                  : treasury?.balanceAda != null
                    ? formatAda(treasury.balanceAda)
                    : '\u2014'}
              </p>
            )}
            {treasury && (
              <div className={cn('flex items-center gap-1 pb-1', trendColor)}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-xs font-medium capitalize">{treasury.trend ?? 'stable'}</span>
              </div>
            )}
          </div>
        </div>
        <div className="px-1 pb-1">
          {historyLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : snapshots.length > 1 ? (
            <BalanceSparkline snapshots={snapshots} />
          ) : null}
        </div>
        {snapshots.length > 1 && (
          <div className="flex justify-between px-5 py-2 border-t border-border text-[11px] text-muted-foreground">
            <span>Epoch {snapshots[0]?.epoch}</span>
            <span>30-epoch trend</span>
            <span>Epoch {snapshots[snapshots.length - 1]?.epoch}</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <Clock className="h-3.5 w-3.5" />
            Runway
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <>
              <p
                className={cn(
                  'font-display text-3xl font-bold tabular-nums',
                  (treasury?.runwayMonths ?? 0) > 24 ? 'text-emerald-400' : 'text-amber-400',
                )}
              >
                {(treasury?.runwayMonths ?? 0) >= 999
                  ? '10+ years'
                  : treasury?.runwayMonths != null
                    ? `${treasury.runwayMonths}mo`
                    : '\u2014'}
              </p>
              {treasury?.burnRatePerEpoch != null && (
                <p className="text-xs text-muted-foreground">
                  {formatAda(treasury.burnRatePerEpoch)} / epoch
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider font-medium">
            <DollarSign className="h-3.5 w-3.5" />
            Withdrawals
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <p
                className={cn(
                  'font-display text-3xl font-bold tabular-nums',
                  ((treasury?.pendingCount ?? treasury?.pendingWithdrawals ?? 0) as number) > 0
                    ? 'text-amber-400'
                    : 'text-muted-foreground',
                )}
              >
                {treasury?.pendingCount ?? treasury?.pendingWithdrawals ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">pending</p>
            </>
          )}
        </div>
      </div>

      {/* Health score */}
      {treasury?.healthScore != null && (
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Treasury Health Score
            </p>
            <p
              className={cn(
                'font-display text-xl font-bold tabular-nums',
                (treasury.healthScore ?? 0) >= 70
                  ? 'text-emerald-400'
                  : (treasury.healthScore ?? 0) >= 40
                    ? 'text-amber-400'
                    : 'text-rose-400',
              )}
            >
              {treasury.healthScore ?? 0}
            </p>
          </div>
          <GlowBar
            value={treasury.healthScore ?? 0}
            fillClass={
              (treasury.healthScore ?? 0) >= 70
                ? 'bg-emerald-500'
                : (treasury.healthScore ?? 0) >= 40
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
            }
            glowColor={
              (treasury.healthScore ?? 0) >= 70
                ? '#10b981'
                : (treasury.healthScore ?? 0) >= 40
                  ? '#f59e0b'
                  : '#ef4444'
            }
            height={8}
          />
        </div>
      )}

      {/* Pending withdrawals list */}
      {!pendingLoading && pendingItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Pending Withdrawals
          </p>
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md divide-y divide-border overflow-hidden">
            {pendingItems.map((item, idx: number) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.title ?? item.proposalType ?? 'Treasury withdrawal'}
                  </p>
                  {item.amountAda != null && (
                    <p className="text-xs text-muted-foreground">{formatAda(item.amountAda)}</p>
                  )}
                </div>
                {(item.txHash || item.tx_hash) && (
                  <Link
                    href={`/proposal/${item.txHash ?? item.tx_hash}/${item.index ?? 0}`}
                    className="ml-3 shrink-0"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
