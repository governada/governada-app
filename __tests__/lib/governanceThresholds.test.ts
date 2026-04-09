import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockEpochParamsRows(
  responses: Array<{ data: Record<string, unknown> | null; error?: unknown }>,
) {
  let responseIndex = 0;
  const maybeSingle = vi.fn().mockImplementation(async () => {
    const nextResponse = responses[Math.min(responseIndex, responses.length - 1)];
    responseIndex += 1;
    return {
      data: nextResponse?.data ?? null,
      error: nextResponse?.error ?? null,
    };
  });
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn((table: string) => {
    if (table !== 'epoch_params') {
      throw new Error(`Unexpected table: ${table}`);
    }
    return { select };
  });

  return { client: { from }, maybeSingle };
}

describe('governance threshold resolver', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses Supabase epoch_params and the maximum threshold for mixed parameter groups', async () => {
    const fetchGovernanceThresholds = vi.fn();
    const epochParams = mockEpochParamsRows([
      {
        data: {
          epoch_no: 551,
          dvt_p_p_network_group: 0.51,
          dvt_p_p_gov_group: 0.67,
        },
      },
    ]);

    vi.doMock('@/lib/supabase', () => ({
      createClient: () => epochParams.client,
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
    const epochParams = mockEpochParamsRows([
      {
        data: {
          epoch_no: 551,
          dvt_p_p_economic_group: 0.6,
          dvt_p_p_technical_group: 0.72,
        },
      },
    ]);

    vi.doMock('@/lib/supabase', () => ({
      createClient: () => epochParams.client,
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
      createClient: () => mockEpochParamsRows([{ data: null }]).client,
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

  it('reuses cached Supabase thresholds inside the revalidation window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));

    const epochParams = mockEpochParamsRows([
      {
        data: {
          epoch_no: 551,
          dvt_treasury_withdrawal: 0.75,
        },
      },
    ]);

    vi.doMock('@/lib/supabase', () => ({
      createClient: () => epochParams.client,
    }));
    vi.doMock('@/utils/koios', () => ({
      fetchGovernanceThresholds: vi.fn(),
    }));

    const mod = await import('@/lib/governanceThresholds');

    const first = await mod.getGovernanceThresholdForProposal({
      proposalType: 'TreasuryWithdrawals',
    });
    const second = await mod.getGovernanceThresholdForProposal({
      proposalType: 'TreasuryWithdrawals',
    });

    expect(first.threshold).toBe(0.75);
    expect(second.threshold).toBe(0.75);
    expect(epochParams.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('refreshes cached Supabase thresholds when epoch_params changes before the long TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T12:00:00Z'));

    const epochParams = mockEpochParamsRows([
      {
        data: {
          epoch_no: 551,
          dvt_treasury_withdrawal: 0.75,
        },
      },
      {
        data: {
          epoch_no: 551,
          dvt_treasury_withdrawal: 0.82,
        },
      },
    ]);

    vi.doMock('@/lib/supabase', () => ({
      createClient: () => epochParams.client,
    }));
    vi.doMock('@/utils/koios', () => ({
      fetchGovernanceThresholds: vi.fn(),
    }));

    const mod = await import('@/lib/governanceThresholds');

    const first = await mod.getGovernanceThresholdForProposal({
      proposalType: 'TreasuryWithdrawals',
    });

    vi.setSystemTime(new Date('2026-04-09T12:01:01Z'));

    const second = await mod.getGovernanceThresholdForProposal({
      proposalType: 'TreasuryWithdrawals',
    });

    expect(first.threshold).toBe(0.75);
    expect(second.threshold).toBe(0.82);
    expect(epochParams.maybeSingle).toHaveBeenCalledTimes(2);
  });
});
