import { createClient } from '@/lib/supabase';
import {
  calculateBurnRate,
  calculateRunwayMonths,
  getNclUtilization,
  getTreasuryBalance,
  getTreasuryTrend,
  lovelaceToAda,
  type NclUtilization,
} from '@/lib/treasury';

export interface GovernanceTreasuryContext {
  treasuryData: {
    balanceAda: number;
    epoch: number;
    snapshotAt: string;
  };
  burnRatePerEpoch: number;
  ncl: NclUtilization | null;
  recentRatifiedWithdrawalsAda: number;
  runwayMonths: number;
  tier: 'large' | 'medium' | 'small' | 'unknown';
}

function getTreasuryTier(balanceAda: number): GovernanceTreasuryContext['tier'] {
  if (!Number.isFinite(balanceAda) || balanceAda <= 0) return 'unknown';
  if (balanceAda > 10_000_000_000) return 'large';
  if (balanceAda > 1_000_000_000) return 'medium';
  return 'small';
}

export async function fetchGovernanceTreasuryContext(): Promise<GovernanceTreasuryContext | null> {
  const supabase = createClient();
  const [treasuryData, ncl, trend, recentRatifiedWithdrawalsResult] = await Promise.all([
    getTreasuryBalance().catch(() => null),
    getNclUtilization().catch(() => null),
    getTreasuryTrend(10).catch(() => []),
    supabase
      .from('proposals')
      .select('withdrawal_amount')
      .eq('proposal_type', 'TreasuryWithdrawals')
      .not('ratified_epoch', 'is', null),
  ]);

  if (!treasuryData) return null;

  const burnRatePerEpoch = calculateBurnRate(trend);
  const runwayMonths = calculateRunwayMonths(treasuryData.balanceAda, burnRatePerEpoch);
  const recentRatifiedWithdrawalsAda = (recentRatifiedWithdrawalsResult.data ?? []).reduce(
    (sum, proposal) => sum + lovelaceToAda(proposal.withdrawal_amount || 0),
    0,
  );

  return {
    treasuryData,
    burnRatePerEpoch,
    ncl,
    recentRatifiedWithdrawalsAda,
    runwayMonths,
    tier: getTreasuryTier(treasuryData.balanceAda),
  };
}
