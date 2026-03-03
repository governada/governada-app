import { NextResponse } from 'next/server';
import { getTreasuryBalance, getPendingTreasuryProposals } from '@/lib/treasury';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
  } catch (error) {
    console.error('[treasury/pending] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pending proposals' }, { status: 500 });
  }
}
