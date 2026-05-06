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

describe('PATCH /api/user delegation history', () => {
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

  it('updates delegation_history without capturing mainnet telemetry', async () => {
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
    expect(mockWalletMaybeSingle).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
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

  it('updates sandbox history without capturing telemetry because the sandbox route owns events', async () => {
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
    expect(mockUserUpdatePayload).toHaveBeenCalledWith(
      expect.objectContaining({
        delegation_history: [
          expect.objectContaining({ drepId: 'drep_old', txHash: 'a'.repeat(64) }),
          expect.objectContaining({
            drepId: 'drep_preview',
            txHash: 'sandbox-cce5b91d-406e-4e20-a59e-9012095f9ff5',
          }),
        ],
      }),
    );
    expect(mockWalletMaybeSingle).not.toHaveBeenCalled();
    expect(mockCaptureServerEvent).not.toHaveBeenCalled();
  });
});
