import { describe, expect, it, vi, beforeEach } from 'vitest';

const detectUserSegment = vi.fn();
const maybeSingle = vi.fn();
const limit = vi.fn(() => ({ maybeSingle }));
const order = vi.fn(() => ({ limit }));
const eqRevoked = vi.fn(() => ({ order }));
const eqUser = vi.fn(() => ({ eq: eqRevoked }));
const select = vi.fn(() => ({ eq: eqUser }));
const from = vi.fn(() => ({ select }));
const getSupabaseAdmin = vi.fn(() => ({ from }));
const resolveRewardAddress = vi.fn();

vi.mock('@/lib/walletDetection', () => ({
  detectUserSegment,
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin,
}));

vi.mock('@meshsdk/core', () => ({
  resolveRewardAddress,
}));

const { getWorkspaceDestinationForSegment, resolveWorkspaceDestinationForSession } =
  await import('@/lib/navigation/workspaceEntry');

describe('workspaceEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null });
    detectUserSegment.mockResolvedValue({
      segment: 'citizen',
      poolId: null,
      drepId: null,
      delegatedPool: null,
      delegatedDrep: null,
    });
    resolveRewardAddress.mockReturnValue('stake_test1');
  });

  it('maps governance actors to their owned workspace destinations', () => {
    expect(getWorkspaceDestinationForSegment('drep')).toBe('/workspace/review');
    expect(getWorkspaceDestinationForSegment('spo')).toBe('/workspace/review');
    expect(getWorkspaceDestinationForSegment('citizen')).toBe('/workspace/author');
    expect(getWorkspaceDestinationForSegment('cc')).toBe('/workspace/author');
    expect(getWorkspaceDestinationForSegment('anonymous')).toBe('/workspace/author');
  });

  it('sends missing sessions through the auth-preserving fallback', async () => {
    await expect(resolveWorkspaceDestinationForSession(null)).resolves.toBe(
      '/?connect=1&returnTo=/workspace',
    );
  });

  it('uses preview persona snapshots for synthetic sessions', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        persona_snapshot: {
          segment: 'drep',
        },
      },
    });

    await expect(
      resolveWorkspaceDestinationForSession({
        userId: 'preview-user',
        walletAddress: 'preview_TEST',
        expiresAt: Date.now() + 60_000,
      }),
    ).resolves.toBe('/workspace/review');

    expect(getSupabaseAdmin).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('preview_sessions');
    expect(detectUserSegment).not.toHaveBeenCalled();
  });

  it('routes authenticated stake users through segment detection', async () => {
    detectUserSegment.mockResolvedValue({
      segment: 'spo',
      poolId: 'pool1',
      drepId: null,
      delegatedPool: null,
      delegatedDrep: null,
    });

    await expect(
      resolveWorkspaceDestinationForSession({
        userId: 'user-1',
        walletAddress: 'addr_test1',
        expiresAt: Date.now() + 60_000,
      }),
    ).resolves.toBe('/workspace/review');

    expect(resolveRewardAddress).toHaveBeenCalledWith('addr_test1');
    expect(detectUserSegment).toHaveBeenCalledWith('stake_test1');
  });

  it('falls back to author when a wallet address cannot be resolved to a stake key', async () => {
    resolveRewardAddress.mockImplementation(() => {
      throw new Error('bad address');
    });

    await expect(
      resolveWorkspaceDestinationForSession({
        userId: 'user-2',
        walletAddress: 'addr_bad',
        expiresAt: Date.now() + 60_000,
      }),
    ).resolves.toBe('/workspace/author');

    expect(detectUserSegment).not.toHaveBeenCalled();
  });
});
