import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getDRepDelegationTrend,
  getDRepPercentile,
  getDRepRank,
  getScoreHistory,
  getSocialLinkChecks,
  isDRepClaimed,
} from '@/lib/dreps/profileStats';

const createClientMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createClient: () => createClientMock(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => loggerErrorMock(...args),
  },
}));

describe('lib/dreps/profileStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps score history rows into chart snapshots', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          snapshot_date: '2026-04-01',
          score: 82,
          effective_participation: 75,
          rationale_rate: 60,
          reliability_score: 70,
          profile_completeness: 85,
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from });

    await expect(getScoreHistory('drep1')).resolves.toEqual([
      {
        date: '2026-04-01',
        score: 82,
        effectiveParticipation: 75,
        rationaleRate: 60,
        reliabilityScore: 70,
        profileCompleteness: 85,
      },
    ]);
  });

  it('calculates percentile from score counts', async () => {
    const lt = vi.fn().mockResolvedValue({ count: 72 });
    const gtBelow = vi.fn().mockReturnValue({ lt });
    const selectBelow = vi.fn().mockReturnValue({ gt: gtBelow });

    const gtTotal = vi.fn().mockResolvedValue({ count: 90 });
    const selectTotal = vi.fn().mockReturnValue({ gt: gtTotal });

    const from = vi
      .fn()
      .mockReturnValueOnce({ select: selectBelow })
      .mockReturnValueOnce({ select: selectTotal });
    createClientMock.mockReturnValue({ from });

    await expect(getDRepPercentile(88)).resolves.toBe(80);
  });

  it('returns null rank when the DRep has no stored score', async () => {
    const single = vi.fn().mockResolvedValue({ data: { score: 0 } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from });

    await expect(getDRepRank('drep1')).resolves.toBeNull();
  });

  it('maps delegation snapshots into trend points', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ epoch_no: 520, amount_lovelace: '4500000', delegator_count: 17 }],
    });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from });

    await expect(getDRepDelegationTrend('drep1')).resolves.toEqual([
      { epoch: 520, votingPowerAda: 5, delegatorCount: 17 },
    ]);
  });

  it('maps social link checks into the shared contract', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [
        {
          uri: 'https://example.com',
          status: 'valid',
          http_status: 200,
          last_checked_at: '2026-04-10T00:00:00Z',
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from });

    await expect(getSocialLinkChecks('drep1')).resolves.toEqual([
      {
        uri: 'https://example.com',
        status: 'valid',
        httpStatus: 200,
        lastCheckedAt: '2026-04-10T00:00:00Z',
      },
    ]);
  });

  it('checks claim status through the extracted seam', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ wallet_address: 'addr_test1...' }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createClientMock.mockReturnValue({ from });

    await expect(isDRepClaimed('drep1')).resolves.toBe(true);
  });
});
