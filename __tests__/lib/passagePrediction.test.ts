import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetGovernanceThresholdForProposal = vi.fn();

vi.mock('@/lib/governanceThresholds', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getGovernanceThresholdForProposal: (proposal: unknown) =>
      mockGetGovernanceThresholdForProposal(proposal),
  };
});

import { resolvePassagePredictionThresholds } from '@/lib/passagePrediction';

describe('resolvePassagePredictionThresholds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits SPO thresholds for governance-only parameter changes', async () => {
    mockGetGovernanceThresholdForProposal.mockResolvedValue({
      threshold: 0.75,
      thresholdKey: 'dvt_p_p_gov_group',
      thresholdKeys: ['dvt_p_p_gov_group'],
    });

    const thresholds = await resolvePassagePredictionThresholds({
      proposalType: 'ParameterChange',
      paramChanges: { govActionLifetime: 12 },
    });

    expect(thresholds).toEqual({
      drep: 0.75,
      spo: null,
      cc: 2 / 3,
    });
  });

  it('includes SPO thresholds for security-relevant parameter changes', async () => {
    mockGetGovernanceThresholdForProposal.mockResolvedValue({
      threshold: 0.67,
      thresholdKey: 'dvt_p_p_network_group',
      thresholdKeys: ['dvt_p_p_network_group'],
    });

    const thresholds = await resolvePassagePredictionThresholds({
      proposalType: 'ParameterChange',
      paramChanges: { maxTxSize: 32768 },
    });

    expect(thresholds).toEqual({
      drep: 0.67,
      spo: 0.51,
      cc: 2 / 3,
    });
  });
});
