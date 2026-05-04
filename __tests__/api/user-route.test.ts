import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequest, parseJson } from '../helpers';

const mockCaptureServerEvent = vi.fn();
const mockRequireAuth = vi.fn();
const mockUserSelectSingle = vi.fn();
const mockUserUpdatePayload = vi.fn();
const mockUserUpdateSingle = vi.fn();
const mockWalletMaybeSingle = vi.fn();

vi.mock('@/lib/supabaseAuth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: () => mockUserSelectSingle(),
            }),
          }),
          update: (data: unknown) => {
            mockUserUpdatePayload(data);
            return {
              eq: () => ({
                select: () => ({
                  single: () => mockUserUpdateSingle(),
                }),
              }),
            };
          },
        };
      }

      if (table === 'user_wallets') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => mockWalletMaybeSingle(),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock('@/lib/posthog-server', () => ({
  captureServerEvent: (...args: unknown[]) => mockCaptureServerEvent(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { PATCH } from '@/app/api/user/route';

const stakeAddress = `stake1${'q'.repeat(51)}`;

describe('PATCH /api/user delegation telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', wallet: 'addr1paymentwallet' });
    mockUserSelectSingle.mockResolvedValue({
      data: {
        delegation_history: [
          {
            drepId: 'drep_old',
            timestamp: '2026-05-04T03:00:00.000Z',
            txHash: 'a'.repeat(64),
          },
        ],
      },
      error: null,
    });
    mockWalletMaybeSingle.mockResolvedValue({
      data: { stake_address: stakeAddress },
      error: null,
    });
    mockUserUpdateSingle.mockResolvedValue({
      data: { id: 'user-1', wallet_address: 'addr1paymentwallet' },
      error: null,
    });
  });

  it('captures both delegation success events when delegation_history is appended', async () => {
    const txHash = 'b'.repeat(64);
    const req = createRequest('/api/user', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer valid-token',
        referer: 'https://governada.io/dev/delegation-test',
      },
      body: {
        delegation_history: [
          {
            drepId: 'drep_new',
            timestamp: '2026-05-04T03:05:00.000Z',
            txHash,
            stakeRegistered: true,
          },
        ],
      },
    });

    const res = await PATCH(req);
    await parseJson(res);

    expect(res.status).toBe(200);
    expect(mockUserUpdatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        delegation_history: [
          expect.objectContaining({ drepId: 'drep_old', txHash: 'a'.repeat(64) }),
          expect.objectContaining({ drepId: 'drep_new', txHash }),
        ],
      }),
    );
    expect(mockCaptureServerEvent).toHaveBeenCalledTimes(2);
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      1,
      'delegation_completed',
      expect.objectContaining({
        drep_id: 'drep_new',
        previous_drep_id: 'drep_old',
        tx_hash: txHash,
        stake_registered: true,
        mode: 'mainnet',
        $current_url: 'https://governada.io/dev/delegation-test',
        $host: 'governada.io',
      }),
      stakeAddress,
    );
    expect(mockCaptureServerEvent).toHaveBeenNthCalledWith(
      2,
      'delegated',
      expect.objectContaining({ drep_id: 'drep_new', tx_hash: txHash, mode: 'mainnet' }),
      stakeAddress,
    );
  });

  it('does not capture when the PATCH body has no delegation_history', async () => {
    const req = createRequest('/api/user', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token' },
      body: { display_name: 'Tim' },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockUserSelectSingle).not.toHaveBeenCalled();
    expect(mockWalletMaybeSingle).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it('does not capture when delegation_history is unchanged', async () => {
    const req = createRequest('/api/user', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token' },
      body: {
        delegation_history: [
          {
            drepId: 'drep_old',
            timestamp: '2026-05-04T03:00:00.000Z',
            txHash: 'a'.repeat(64),
          },
        ],
      },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockWalletMaybeSingle).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });

  it('does not capture sandbox history because the sandbox route owns sandbox telemetry', async () => {
    const req = createRequest('/api/user', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer valid-token' },
      body: {
        delegation_history: [
          {
            drepId: 'drep_preview',
            timestamp: '2026-05-04T03:10:00.000Z',
            txHash: 'sandbox-cce5b91d-406e-4e20-a59e-9012095f9ff5',
          },
        ],
      },
    });

    const res = await PATCH(req);

    expect(res.status).toBe(200);
    expect(mockWalletMaybeSingle).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
