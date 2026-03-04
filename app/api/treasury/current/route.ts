import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import {
  getTreasuryBalance,
  getTreasuryTrend,
  calculateBurnRate,
  calculateRunwayMonths,
  calculateTreasuryHealthScore,
  getPendingTreasuryProposals,
} from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const [balance, snapshots, healthScore] = await Promise.all([
    getTreasuryBalance(),
    getTreasuryTrend(30),
    calculateTreasuryHealthScore(),
  ]);

  if (!balance) {
    return NextResponse.json({ error: 'No treasury data available' }, { status: 404 });
  }

  const burnRate = calculateBurnRate(snapshots, 10);
  const runwayMonths = calculateRunwayMonths(balance.balanceAda, burnRate);
  const pending = await getPendingTreasuryProposals(balance.balanceAda);
  const totalPendingAda = pending.reduce((s, p) => s + p.withdrawalAda, 0);

  const prevEpoch = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const trend = prevEpoch
    ? balance.balanceAda > prevEpoch.balanceAda
      ? 'growing'
      : 'shrinking'
    : 'stable';

  return NextResponse.json({
    balance: balance.balanceAda,
    epoch: balance.epoch,
    snapshotAt: balance.snapshotAt,
    runwayMonths: runwayMonths === Infinity ? 999 : Math.round(runwayMonths),
    burnRatePerEpoch: Math.round(burnRate),
    trend,
    healthScore: healthScore?.score ?? null,
    healthComponents: healthScore?.components ?? null,
    pendingCount: pending.length,
    pendingTotalAda: totalPendingAda,
  });
});
