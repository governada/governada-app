'use client';

/**
 * TreasuryImpactWidget — compact card showing treasury context for a withdrawal proposal.
 *
 * Only renders for TreasuryWithdrawals proposals. Shows:
 * - Current treasury balance
 * - This proposal's withdrawal as % of treasury + NCL
 * - Cumulative pending withdrawals
 * - NCL utilization (current + projected)
 * - Runway impact
 */

import { useEffect } from 'react';
import { Landmark, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureGate } from '@/components/FeatureGate';
import { useTreasuryContext } from '@/hooks/useTreasuryContext';
import { formatAda } from '@/lib/treasury';
import { posthog } from '@/lib/posthog';

interface TreasuryImpactWidgetProps {
  withdrawalAmount: number;
  proposalType: string;
  /** All pending treasury withdrawal amounts in the queue (lovelace) for cumulative calc */
  pendingWithdrawals?: number[];
}

function TreasuryImpactContent({
  withdrawalAmount,
  pendingWithdrawals,
}: TreasuryImpactWidgetProps) {
  const { data, isLoading, isError } = useTreasuryContext();

  useEffect(() => {
    if (data) {
      posthog.capture('treasury_impact_viewed', {
        withdrawal_ada: withdrawalAmount / 1_000_000,
        treasury_balance_ada: data.balance,
      });
    }
  }, [data, withdrawalAmount]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Landmark className="h-3.5 w-3.5" />
            Treasury Impact
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return null;
  }

  const withdrawalAda = withdrawalAmount / 1_000_000;
  const pctOfTreasury = data.balance > 0 ? (withdrawalAda / data.balance) * 100 : 0;

  // Cumulative pending including this proposal
  const cumulativePendingAda = pendingWithdrawals
    ? pendingWithdrawals.reduce((sum, w) => sum + w / 1_000_000, 0)
    : data.pendingTotalAda;
  const cumulativePct = data.balance > 0 ? (cumulativePendingAda / data.balance) * 100 : 0;

  // Runway impact: current months vs projected if this withdrawal passes
  const projectedBalance = data.balance - withdrawalAda;
  const projectedRunway =
    data.burnRatePerEpoch > 0
      ? Math.round((projectedBalance / data.burnRatePerEpoch) * (5 / 30.44))
      : data.runwayMonths;

  const TrendIcon =
    data.trend === 'growing' ? TrendingUp : data.trend === 'shrinking' ? TrendingDown : Minus;
  const trendColor =
    data.trend === 'growing'
      ? 'text-emerald-500'
      : data.trend === 'shrinking'
        ? 'text-rose-500'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Landmark className="h-3.5 w-3.5" />
          Treasury Impact
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {/* Current balance */}
          <div>
            <span className="text-muted-foreground">Treasury Balance</span>
            <p className="font-medium text-foreground tabular-nums flex items-center gap-1">
              {formatAda(data.balance)} ADA
              <TrendIcon className={`h-3 w-3 ${trendColor}`} />
            </p>
          </div>

          {/* This proposal */}
          <div>
            <span className="text-muted-foreground">This Proposal</span>
            <p className="font-medium text-foreground tabular-nums">
              {formatAda(withdrawalAda)} ADA
              <span className="text-muted-foreground ml-1">({pctOfTreasury.toFixed(2)}%)</span>
            </p>
          </div>

          {/* Cumulative pending */}
          <div>
            <span className="text-muted-foreground">Cumulative Pending</span>
            <p className="font-medium text-foreground tabular-nums">
              {formatAda(cumulativePendingAda)} ADA
              <span className="text-muted-foreground ml-1">({cumulativePct.toFixed(1)}%)</span>
            </p>
          </div>

          {/* Pending count */}
          <div>
            <span className="text-muted-foreground">Pending Proposals</span>
            <p className="font-medium text-foreground tabular-nums">{data.pendingCount}</p>
          </div>

          {/* Runway: current vs projected */}
          <div className="col-span-2">
            <span className="text-muted-foreground">Runway Impact</span>
            <p className="font-medium text-foreground tabular-nums">
              {data.runwayMonths >= 999 ? '99+' : data.runwayMonths} months
              <span className="text-muted-foreground mx-1">&rarr;</span>
              <span
                className={
                  projectedRunway < data.runwayMonths * 0.9 ? 'text-amber-500' : 'text-emerald-500'
                }
              >
                {projectedRunway >= 999 ? '99+' : projectedRunway} months
              </span>
              <span className="text-muted-foreground ml-1">if approved</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TreasuryImpactWidget(props: TreasuryImpactWidgetProps) {
  // Only render for TreasuryWithdrawals proposals
  if (props.proposalType !== 'TreasuryWithdrawals') return null;

  return (
    <FeatureGate flag="review_treasury_impact">
      <TreasuryImpactContent {...props} />
    </FeatureGate>
  );
}
