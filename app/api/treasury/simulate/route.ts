import { NextRequest, NextResponse } from 'next/server';
import {
  getTreasuryBalance,
  getTreasuryTrend,
  calculateBurnRate,
  projectRunway,
  getCounterfactualAnalysis,
} from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const burnAdjust = parseFloat(searchParams.get('burnAdjust') || '1');
    const customPendingAda = searchParams.get('pendingAda')
      ? parseFloat(searchParams.get('pendingAda')!)
      : undefined;

    const [balance, snapshots] = await Promise.all([getTreasuryBalance(), getTreasuryTrend(30)]);

    if (!balance) {
      return NextResponse.json({ error: 'No treasury data' }, { status: 404 });
    }

    const burnRate = calculateBurnRate(snapshots, 10) * burnAdjust;
    const avgIncome =
      snapshots.length > 0
        ? snapshots.reduce((s, r) => s + r.reservesIncomeAda, 0) / snapshots.length
        : 0;

    // Calculate pending total from DB unless overridden
    let pendingTotalAda = customPendingAda ?? 0;
    if (customPendingAda === undefined) {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
      const { data } = await supabase
        .from('proposals')
        .select('withdrawal_amount')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null);
      pendingTotalAda = (data || []).reduce((sum, p) => sum + (p.withdrawal_amount || 0), 0);
    }

    const scenarios = projectRunway(
      balance.balanceAda,
      burnRate,
      avgIncome,
      balance.epoch,
      pendingTotalAda,
      365,
    );

    const counterfactual = await getCounterfactualAnalysis(balance.balanceAda, burnRate);

    return NextResponse.json({
      currentBalance: balance.balanceAda,
      currentEpoch: balance.epoch,
      burnRatePerEpoch: Math.round(burnRate),
      avgIncomePerEpoch: Math.round(avgIncome),
      pendingTotalAda,
      scenarios: scenarios.map((s) => ({
        name: s.name,
        key: s.key,
        projectedMonths: s.projectedMonths,
        depletionEpoch: s.depletionEpoch,
        balanceCurve: s.balanceCurve.filter(
          (_, i) => i % 5 === 0 || i === s.balanceCurve.length - 1,
        ),
      })),
      counterfactual,
    });
  } catch (error) {
    console.error('[treasury/simulate] Error:', error);
    return NextResponse.json({ error: 'Failed to simulate' }, { status: 500 });
  }
}
