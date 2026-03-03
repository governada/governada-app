import { NextRequest, NextResponse } from 'next/server';
import { getTreasuryTrend, getIncomeVsOutflow } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('[treasury/history] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch treasury history' }, { status: 500 });
  }
}
