import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockEpochParamsRow(row: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn((table: string) => {
    if (table !== 'epoch_params') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return { select };
  });

  return { from };
}

describe('governance threshold resolver', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('uses Supabase epoch_params and the maximum threshold for mixed parameter groups', async () => {
    const fetchGovernanceThresholds = vi.fn();

    vi.doMock('@/lib/supabase', () => ({
      createClient: () =>
        mockEpochParamsRow({
          epoch_no: 551,
          dvt_p_p_network_group: 0.51,
          dvt_p_p_gov_group: 0.67,
        }),
    }));
    vi.doMock('@/utils/koios', () => ({
      fetchGovernanceThresholds,
    }));

    const mod = await import('@/lib/governanceThresholds');
    const result = await mod.getGovernanceThresholdForProposal({
      proposalType: 'ParameterChange',
      paramChanges: {
        maxTxSize: 32768,
        govActionLifetime: 10,
      },
    });

    expect(result).toEqual({
      threshold: 0.67,
      thresholdKey: 'dvt_p_p_gov_group',
      thresholdKeys: ['dvt_p_p_network_group', 'dvt_p_p_gov_group'],
    });
    expect(fetchGovernanceThresholds).not.toHaveBeenCalled();
  });

  it('supports legacy parameter aliases when resolving parameter-change groups', async () => {
    vi.doMock('@/lib/supabase', () => ({
      createClient: () =>
        mockEpochParamsRow({
          epoch_no: 551,
          dvt_p_p_economic_group: 0.6,
          dvt_p_p_technical_group: 0.72,
        }),
    }));
    vi.doMock('@/utils/koios', () => ({
      fetchGovernanceThresholds: vi.fn(),
    }));

    const mod = await import('@/lib/governanceThresholds');
    const result = await mod.getGovernanceThresholdForProposal({
      proposalType: 'ParameterChange',
      paramChanges: {
        keyDeposit: 2000000,
        a0: 0.3,
      },
    });

    expect(result).toEqual({
      threshold: 0.72,
      thresholdKey: 'dvt_p_p_technical_group',
      thresholdKeys: ['dvt_p_p_economic_group', 'dvt_p_p_technical_group'],
    });
  });

  it('falls back to Koios when epoch_params thresholds are unavailable', async () => {
    const fetchGovernanceThresholds = vi.fn().mockResolvedValue({
      dvt_treasury_withdrawal: 0.75,
    });

    vi.doMock('@/lib/supabase', () => ({
      createClient: () => mockEpochParamsRow(null),
    }));
    vi.doMock('@/utils/koios', () => ({
      fetchGovernanceThresholds,
    }));

    const mod = await import('@/lib/governanceThresholds');
    const result = await mod.getGovernanceThresholdForProposal({
      proposalType: 'TreasuryWithdrawals',
    });

    expect(result).toEqual({
      threshold: 0.75,
      thresholdKey: 'dvt_treasury_withdrawal',
      thresholdKeys: ['dvt_treasury_withdrawal'],
    });
    expect(fetchGovernanceThresholds).toHaveBeenCalledTimes(1);
  });
});
