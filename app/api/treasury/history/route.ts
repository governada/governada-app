import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getTreasuryTrend, getIncomeVsOutflow } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const { searchParams } = new URL(request.url);
  const epochs = Math.min(parseInt(searchParams.get('epochs') || '90'), 500);

  const snapshots = await getTreasuryTrend(epochs);
  const incomeVsOutflow = getIncomeVsOutflow(snapshots);

  return NextResponse.json({
    snapshots: snapshots.map((s) => ({
      epoch: s.epoch,
      balanceAda: s.balanceAda,
      withdrawalsAda: s.withdrawalsAda,
      reservesIncomeAda: s.reservesIncomeAda,
    })),
    incomeVsOutflow,
  });
});
