import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { fetchAccountInfo } from '@/utils/koios';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/account-info?stakeAddress=stake1...
 * Returns ADA balance and delegation info for a stake address.
 * Public data from Koios — no auth required.
 */
export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');

    if (!stakeAddress || !stakeAddress.startsWith('stake')) {
      return NextResponse.json({ error: 'Required: valid stakeAddress' }, { status: 400 });
    }

    const account = await fetchAccountInfo(stakeAddress);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Convert lovelace strings to ADA numbers
    const totalBalanceAda = parseInt(account.total_balance, 10) / 1_000_000;
    const rewardsAda = parseInt(account.rewards_available, 10) / 1_000_000;

    return NextResponse.json(
      {
        stakeAddress: account.stake_address,
        totalBalanceAda,
        rewardsAda,
        delegatedDrep: account.vote_delegation,
        delegatedPool: account.delegated_pool,
      },
      {
        headers: { 'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=300' },
      },
    );
  },
  { rateLimit: { max: 30, window: 60 } },
);
