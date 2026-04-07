import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchGovernanceTreasuryContext } from '@/lib/governance/treasuryContext';

const createClientMock = vi.fn();
const getTreasuryBalanceMock = vi.fn();
const getNclUtilizationMock = vi.fn();
const getTreasuryTrendMock = vi.fn();
const calculateBurnRateMock = vi.fn();
const calculateRunwayMonthsMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createClient: () => createClientMock(),
}));

vi.mock('@/lib/treasury', () => ({
  calculateBurnRate: (...args: unknown[]) => calculateBurnRateMock(...args),
  calculateRunwayMonths: (...args: unknown[]) => calculateRunwayMonthsMock(...args),
  getNclUtilization: () => getNclUtilizationMock(),
  getTreasuryBalance: () => getTreasuryBalanceMock(),
  getTreasuryTrend: (...args: unknown[]) => getTreasuryTrendMock(...args),
  lovelaceToAda: (value: bigint | number | string) => Number(value) / 1_000_000,
}));

function mockSupabaseRecentWithdrawals(data: Array<{ withdrawal_amount: number }>) {
  const not = vi.fn().mockResolvedValue({ data });
  const eq = vi.fn().mockReturnValue({ not });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  createClientMock.mockReturnValue({ from });

  return { from, select, eq, not };
}

describe('fetchGovernanceTreasuryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no treasury snapshot is available', async () => {
    mockSupabaseRecentWithdrawals([]);
    getTreasuryBalanceMock.mockResolvedValue(null);
    getNclUtilizationMock.mockResolvedValue(null);
    getTreasuryTrendMock.mockResolvedValue([]);
    calculateBurnRateMock.mockReturnValue(0);
    calculateRunwayMonthsMock.mockReturnValue(0);

    await expect(fetchGovernanceTreasuryContext()).resolves.toBeNull();
  });

  it('builds a shared treasury context and converts ratified withdrawals to ADA', async () => {
    mockSupabaseRecentWithdrawals([
      { withdrawal_amount: 2_500_000 },
      { withdrawal_amount: 5_000_000 },
    ]);

    getTreasuryBalanceMock.mockResolvedValue({
      balanceAda: 2_000_000_000,
      epoch: 601,
      snapshotAt: '2026-04-05T00:00:00.000Z',
    });
    getNclUtilizationMock.mockResolvedValue({
      utilizationPct: 42,
      remainingAda: 120_000_000,
    });
    getTreasuryTrendMock.mockResolvedValue([{ epoch: 600, balanceAda: 1_999_999_000 }]);
    calculateBurnRateMock.mockReturnValue(12_345);
    calculateRunwayMonthsMock.mockReturnValue(36);

    await expect(fetchGovernanceTreasuryContext()).resolves.toEqual({
      treasuryData: {
        balanceAda: 2_000_000_000,
        epoch: 601,
        snapshotAt: '2026-04-05T00:00:00.000Z',
      },
      burnRatePerEpoch: 12_345,
      ncl: {
        utilizationPct: 42,
        remainingAda: 120_000_000,
      },
      recentRatifiedWithdrawalsAda: 7.5,
      runwayMonths: 36,
      tier: 'medium',
    });
  });
});
