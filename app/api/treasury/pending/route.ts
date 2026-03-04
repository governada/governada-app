import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getTreasuryBalance, getPendingTreasuryProposals } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const balance = await getTreasuryBalance();
  if (!balance) {
    return NextResponse.json({ error: 'No treasury data' }, { status: 404 });
  }

  const pending = await getPendingTreasuryProposals(balance.balanceAda);
  const totalAda = pending.reduce((s, p) => s + p.withdrawalAda, 0);

  return NextResponse.json({
    proposals: pending,
    totalAda,
    pctOfTreasury:
      balance.balanceAda > 0 ? ((totalAda / balance.balanceAda) * 100).toFixed(2) : '0',
    treasuryBalanceAda: balance.balanceAda,
  });
});
