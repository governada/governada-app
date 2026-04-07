import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { WalletConnectionSnapshot } from '@/utils/wallet-context';

const connect = vi.fn<(walletName: string) => Promise<WalletConnectionSnapshot | null>>();
const authenticate = vi.fn<(connection?: WalletConnectionSnapshot) => Promise<boolean>>();
const clearWalletError = vi.fn();
const posthogCapture = vi.fn();

vi.mock('@/utils/wallet-context', () => ({
  useWallet: () => ({
    availableWallets: ['lace'],
    connect,
    authenticate,
    clearError: clearWalletError,
  }),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: posthogCapture },
}));

const { useQuickConnect } = await import('@/hooks/useQuickConnect');

describe('useQuickConnect', () => {
  const connection: WalletConnectionSnapshot = {
    walletName: 'lace',
    address: 'addr_test1vr5example',
    hexAddress: '00deadbeef',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    connect.mockResolvedValue(connection);
    authenticate.mockResolvedValue(true);
  });

  it('authenticates with the fresh connection snapshot from connect', async () => {
    const { result } = renderHook(() => useQuickConnect());

    await act(async () => {
      await result.current.quickConnect();
    });

    expect(connect).toHaveBeenCalledWith('lace');
    expect(authenticate).toHaveBeenCalledWith(connection);
    expect(result.current.error).toBeNull();
  });

  it('surfaces a connection failure when connect returns null', async () => {
    connect.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useQuickConnect());

    await act(async () => {
      await result.current.quickConnect();
    });

    expect(authenticate).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Connection failed. Please try again.');
  });
});
