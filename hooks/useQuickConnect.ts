'use client';

import { useState, useCallback, useMemo } from 'react';
import { useWallet } from '@/utils/wallet-context';
import { posthog } from '@/lib/posthog';

/**
 * Preferred wallet order — matches WalletConnectModal.
 * First detected wallet from this list becomes the "primary" suggestion.
 */
const PREFERRED_WALLETS = ['eternl', 'lace', 'nami', 'typhon', 'vespr'];

/** Capitalize wallet name for display (e.g., "eternl" → "Eternl") */
function displayName(wallet: string): string {
  return wallet.charAt(0).toUpperCase() + wallet.slice(1);
}

export interface UseQuickConnectReturn {
  /** Wallets detected in the browser, sorted by preference */
  detectedWallets: string[];
  /** Best candidate wallet (first from preference list, or first available) */
  primaryWallet: string | null;
  /** Display-friendly name for the primary wallet */
  primaryWalletLabel: string | null;
  /** Connect + authenticate in one step. Uses primaryWallet if no name given. */
  quickConnect: (walletName?: string) => Promise<boolean>;
  /** True while connecting or authenticating */
  isConnecting: boolean;
  /** Error message from last attempt, if any */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** True when no wallets are detected and we need the full modal */
  needsFullModal: boolean;
  /** True when exactly one wallet is detected (show direct button, no dropdown) */
  hasSingleWallet: boolean;
}

export function useQuickConnect(): UseQuickConnectReturn {
  const { availableWallets, connect, authenticate, clearError: clearWalletError } = useWallet();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedWallets = useMemo(() => {
    // Sort available wallets by preference order
    return [...availableWallets].sort((a, b) => {
      const aIdx = PREFERRED_WALLETS.indexOf(a.toLowerCase());
      const bIdx = PREFERRED_WALLETS.indexOf(b.toLowerCase());
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [availableWallets]);

  const primaryWallet = detectedWallets.length > 0 ? detectedWallets[0] : null;
  const primaryWalletLabel = primaryWallet ? displayName(primaryWallet) : null;
  const needsFullModal = detectedWallets.length === 0;
  const hasSingleWallet = detectedWallets.length === 1;

  const clearError = useCallback(() => {
    setError(null);
    clearWalletError();
  }, [clearWalletError]);

  const quickConnect = useCallback(
    async (walletName?: string): Promise<boolean> => {
      const target = walletName ?? primaryWallet;
      if (!target) {
        setError('No wallet detected');
        return false;
      }

      setIsConnecting(true);
      setError(null);
      clearWalletError();

      posthog.capture('quick_connect_attempted', {
        wallet_name: target,
        detection_method: walletName ? 'user_selected' : 'auto_primary',
        wallets_available: detectedWallets.length,
      });

      try {
        // Step 1: Connect to wallet extension
        const connection = await connect(target);
        if (!connection) {
          setError('Connection failed. Please try again.');
          posthog.capture('quick_connect_failed', {
            wallet_name: target,
            reason: 'connect_returned_null',
          });
          return false;
        }

        // Step 2: Authenticate against the just-connected wallet snapshot.
        const success = await authenticate(connection);

        if (success) {
          posthog.capture('quick_connect_succeeded', { wallet_name: target });
          return true;
        } else {
          setError('Authentication failed. Please try again.');
          posthog.capture('quick_connect_failed', {
            wallet_name: target,
            reason: 'auth_returned_false',
          });
          return false;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';

        // Don't show error for user rejections — they know they cancelled
        const isRejection =
          message.toLowerCase().includes('reject') ||
          message.toLowerCase().includes('cancel') ||
          message.toLowerCase().includes('declined');

        if (!isRejection) {
          setError(message);
        }

        posthog.capture('quick_connect_failed', {
          wallet_name: target,
          reason: isRejection ? 'user_rejected' : 'error',
          error: message,
        });

        return false;
      } finally {
        setIsConnecting(false);
      }
    },
    [primaryWallet, detectedWallets.length, connect, authenticate, clearWalletError],
  );

  return {
    detectedWallets,
    primaryWallet,
    primaryWalletLabel,
    quickConnect,
    isConnecting,
    error,
    clearError,
    needsFullModal,
    hasSingleWallet,
  };
}
