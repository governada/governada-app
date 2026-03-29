'use client';

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserWallet, resolveRewardAddress } from '@meshsdk/core';
import {
  getStoredSession,
  saveSession,
  clearSession,
  clearSessionCookie,
  parseSessionToken,
  isSessionExpired,
} from '@/lib/supabaseAuth';
import { deriveDRepIdFromStakeAddress, checkDRepExists } from '@/utils/drepId';
import { WalletContext, type WalletError } from '@/utils/wallet-context';
export type { WalletContextType, WalletError, WalletErrorType } from '@/utils/wallet-context';
export { useWallet } from '@/utils/wallet-context';

interface CIP30Api {
  getUsedAddresses(): Promise<string[]>;
  getUnusedAddresses(): Promise<string[]>;
  signData(addr: string, payload: string): Promise<{ signature: string; key: string }>;
}

/** Hash wallet address for analytics (client-side, using Web Crypto API) */
async function hashForAnalytics(address: string): Promise<string> {
  const data = new TextEncoder().encode(address);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `wallet_${hex.slice(0, 16)}`;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.info === 'string') return obj.info;
    if (typeof obj.code === 'number' || typeof obj.code === 'string') {
      return `Error code: ${obj.code}`;
    }
    try {
      const str = JSON.stringify(err);
      if (str !== '{}') return str;
    } catch {
      // Ignore stringify errors
    }
  }
  return 'Unknown error';
}

function categorizeError(err: unknown, walletName?: string): WalletError {
  const message = extractErrorMessage(err);
  const lowerMessage = message.toLowerCase();

  // Check for user rejection/cancellation patterns
  if (
    (lowerMessage.includes('user') &&
      (lowerMessage.includes('reject') ||
        lowerMessage.includes('cancel') ||
        lowerMessage.includes('declined'))) ||
    lowerMessage.includes('cancelled') ||
    lowerMessage.includes('user declined') ||
    lowerMessage.includes('refused') ||
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as Record<string, unknown>).code === 2) // CIP-30 user declined code
  ) {
    return {
      type: 'user_rejected',
      message: 'Request cancelled',
      hint: 'You cancelled the request. Please try again when ready.',
    };
  }

  // Check for empty wallet
  if (lowerMessage.includes('no addresses') || lowerMessage.includes('empty')) {
    return {
      type: 'no_addresses',
      message: 'No addresses found in wallet',
      hint: 'Your wallet appears empty. Please ensure it has received at least one transaction, or try a different wallet.',
    };
  }

  // Check for extension communication errors (common with Yoroi)
  if (
    lowerMessage.includes('listener') ||
    lowerMessage.includes('channel closed') ||
    lowerMessage.includes('could not access') ||
    lowerMessage.includes('could not send rpc') ||
    lowerMessage.includes('asynchronous response')
  ) {
    return {
      type: 'extension_error',
      message: `Could not communicate with ${walletName || 'wallet'}`,
      hint: `The ${walletName || 'wallet'} extension is not responding. Try refreshing the page, closing and reopening the extension, or using a different wallet.`,
    };
  }

  // Check for network errors
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('timeout')
  ) {
    return {
      type: 'network',
      message: 'Network error',
      hint: 'Please check your internet connection and try again.',
    };
  }

  return {
    type: 'unknown',
    message: message !== 'Unknown error' ? message : 'Something went wrong',
    hint: 'Please try again. If the problem persists, try refreshing the page or using a different wallet.',
  };
}

function getCardanoApi(name: string): { enable(): Promise<CIP30Api> } | undefined {
  const w = window as unknown as { cardano?: Record<string, { enable(): Promise<CIP30Api> }> };
  return w.cardano?.[name];
}

const WALLET_NAME_KEY = 'drepscore_wallet_name';

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [hexAddress, setHexAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [delegatedDrepId, setDelegatedDrepId] = useState<string | null>(null);
  const [ownDRepId, setOwnDRepId] = useState<string | null>(null);
  const [balanceAda, setBalanceAda] = useState<number | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [connectMethod, setConnectMethod] = useState<'extension' | 'peer' | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const isAuthenticated = userId !== null;

  useEffect(() => {
    const checkWallets = () => {
      const wallets = BrowserWallet.getInstalledWallets();
      setAvailableWallets(wallets.map((w) => w.name));
    };

    checkWallets();
    const timer = setTimeout(checkWallets, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const token = getStoredSession();
    if (token) {
      const payload = parseSessionToken(token);
      if (payload && !isSessionExpired(payload)) {
        setUserId(payload.userId);
        setSessionAddress(payload.walletAddress);
      } else {
        clearSession();
      }
    }
  }, []);

  // Auto-reconnect: if we have a valid session and a stored wallet name, silently reconnect
  useEffect(() => {
    const token = getStoredSession();
    const storedWallet = localStorage.getItem(WALLET_NAME_KEY);
    if (!token || !storedWallet) return;

    const payload = parseSessionToken(token);
    if (!payload || isSessionExpired(payload)) return;

    // Peer connect sessions use WebRTC which doesn't survive page reloads.
    // Keep the auth session (userId/sessionAddress) but don't attempt wallet reconnect.
    if (localStorage.getItem('governada_connect_method') === 'peer') {
      localStorage.removeItem(WALLET_NAME_KEY);
      return;
    }

    let cancelled = false;
    setReconnecting(true);

    (async () => {
      try {
        const browserWallet = await BrowserWallet.enable(storedWallet);
        if (cancelled) return;

        let addresses = await browserWallet.getUsedAddresses();
        if (!addresses || addresses.length === 0) {
          addresses = await browserWallet.getUnusedAddresses();
        }

        const rawApi = await getCardanoApi(storedWallet)?.enable();
        let hexAddresses: string[] = [];
        if (rawApi) {
          hexAddresses = await rawApi.getUsedAddresses();
          if (!hexAddresses || hexAddresses.length === 0) {
            hexAddresses = await rawApi.getUnusedAddresses();
          }
        }

        if (cancelled) return;

        if (addresses && addresses.length > 0) {
          setWallet(browserWallet);
          setWalletName(storedWallet);
          setAddress(addresses[0]);
          if (hexAddresses.length > 0) setHexAddress(hexAddresses[0]);
          setConnected(true);

          // Non-blocking: fetch wallet balance
          browserWallet
            .getLovelace()
            .then((lovelace) => {
              if (!cancelled) setBalanceAda(Math.floor(Number(lovelace) / 1_000_000));
            })
            .catch(() => {});

          try {
            const stakeAddr = resolveRewardAddress(addresses[0]);
            if (stakeAddr) {
              fetch('/api/delegation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stakeAddress: stakeAddr }),
              })
                .then((r) => r.json())
                .then(({ drepId }) => {
                  if (!cancelled && drepId) setDelegatedDrepId(drepId);
                })
                .catch(() => {});

              const derivedDRepId = deriveDRepIdFromStakeAddress(stakeAddr);
              if (derivedDRepId) {
                checkDRepExists(derivedDRepId).then((exists) => {
                  if (!cancelled && exists) setOwnDRepId(derivedDRepId);
                });
              }
            }
          } catch {
            /* ignore stake resolution failures */
          }
        }
      } catch {
        // Wallet extension unavailable — clear stored name but preserve session
        localStorage.removeItem(WALLET_NAME_KEY);
      } finally {
        if (!cancelled) setReconnecting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const connect = async (name: string) => {
    setConnecting(true);
    setError(null);

    try {
      const browserWallet = await BrowserWallet.enable(name);
      setWallet(browserWallet);
      setWalletName(name);

      // Try used addresses first, then fall back to unused addresses
      let addresses = await browserWallet.getUsedAddresses();
      if (!addresses || addresses.length === 0) {
        addresses = await browserWallet.getUnusedAddresses();
      }

      // Also get hex address from raw CIP-30 API for signData
      const rawApi = await getCardanoApi(name)?.enable();
      let hexAddresses: string[] = [];
      if (rawApi) {
        hexAddresses = await rawApi.getUsedAddresses();
        if (!hexAddresses || hexAddresses.length === 0) {
          hexAddresses = await rawApi.getUnusedAddresses();
        }
      }

      if (addresses && addresses.length > 0) {
        setAddress(addresses[0]);
        if (hexAddresses.length > 0) setHexAddress(hexAddresses[0]);
        setConnected(true);
        localStorage.setItem(WALLET_NAME_KEY, name);

        // Detect if this was a peer connect (wallet wasn't in detected extensions)
        const wasPeerConnect = !availableWallets.includes(name);
        setConnectMethod(wasPeerConnect ? 'peer' : 'extension');
        if (wasPeerConnect) {
          localStorage.setItem('governada_connect_method', 'peer');
        } else {
          localStorage.removeItem('governada_connect_method');
        }

        // Non-blocking: fetch wallet balance
        browserWallet
          .getLovelace()
          .then((lovelace) => setBalanceAda(Math.floor(Number(lovelace) / 1_000_000)))
          .catch(() => {});

        try {
          const { posthog } = await import('@/lib/posthog');
          // Hash wallet address before sending to PostHog for privacy
          const hashedId = await hashForAnalytics(addresses[0]);
          posthog.capture('wallet_connected', { wallet_type: name });
          posthog.identify(hashedId, { segment: 'holder', wallet_type: name });
          // Funnel event: wallet connected
          const { trackFunnel, FUNNEL_EVENTS } = await import('@/lib/funnel');
          trackFunnel(FUNNEL_EVENTS.WALLET_CONNECTED, { source: name });
        } catch {
          /* posthog optional */
        }

        // Non-blocking: resolve stake address, derive DRep ID, and look up delegation
        try {
          const stakeAddr = resolveRewardAddress(addresses[0]);
          if (stakeAddr) {
            // Delegation lookup
            fetch('/api/delegation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stakeAddress: stakeAddr }),
            })
              .then((r) => r.json())
              .then(({ drepId }) => {
                if (drepId) setDelegatedDrepId(drepId);
              })
              .catch(() => {});

            // Derive DRep ID and verify it exists in our database
            const derivedDRepId = deriveDRepIdFromStakeAddress(stakeAddr);
            if (derivedDRepId) {
              checkDRepExists(derivedDRepId).then((exists) => {
                if (exists) setOwnDRepId(derivedDRepId);
              });
            }
          }
        } catch {
          // Stake address resolution can fail for script addresses — ignore
        }
      } else {
        throw new Error('No addresses found in wallet');
      }
    } catch (err) {
      setError(categorizeError(err, name));
      console.error('Wallet connection error:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    setWalletName(null);
    setConnected(false);
    setAddress(null);
    setHexAddress(null);
    setDelegatedDrepId(null);
    setOwnDRepId(null);
    setBalanceAda(null);
    setError(null);
    setConnectMethod(null);
    localStorage.removeItem(WALLET_NAME_KEY);
    localStorage.removeItem('governada_connect_method');
  };

  const signMessage = useCallback(
    async (message: string): Promise<{ signature: string; key: string } | null> => {
      if (!walletName || !hexAddress) {
        setError({
          type: 'unknown',
          message: 'Wallet not connected',
          hint: 'Please connect your wallet first.',
        });
        return null;
      }

      try {
        // Bypass MeshJS wrapper — it incorrectly bech32-decodes the payload.
        // CIP-30 signData expects hex address + hex-encoded payload.
        const rawApi = await getCardanoApi(walletName)?.enable();
        if (!rawApi) throw new Error('Could not access wallet API');

        const hexPayload = Array.from(new TextEncoder().encode(message))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const result = await rawApi.signData(hexAddress, hexPayload);
        return { signature: result.signature, key: result.key };
      } catch (err) {
        setError(categorizeError(err, walletName));
        console.error('Sign message error:', err);
        return null;
      }
    },
    [walletName, hexAddress],
  );

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!walletName || !address || !hexAddress) {
      setError({
        type: 'unknown',
        message: 'Connect wallet first',
        hint: 'Please connect your wallet before signing in.',
      });
      return false;
    }

    try {
      const nonceController = new AbortController();
      const nonceTimer = setTimeout(() => nonceController.abort(), 15000);
      const nonceResponse = await fetch('/api/auth/nonce', {
        signal: nonceController.signal,
      });
      clearTimeout(nonceTimer);
      if (!nonceResponse.ok) throw new Error('Network error fetching nonce');
      const { nonce, signature: nonceSignature } = await nonceResponse.json();

      const signResult = await signMessage(nonce);
      if (!signResult) return false;

      const authController = new AbortController();
      const authTimer = setTimeout(() => authController.abort(), 15000);
      const authResponse = await fetch('/api/auth/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          nonce,
          nonceSignature,
          signature: signResult.signature,
          key: signResult.key,
        }),
        signal: authController.signal,
      });
      clearTimeout(authTimer);

      if (!authResponse.ok) {
        const data = await authResponse.json();
        throw new Error(data.error || 'Authentication failed');
      }

      const { sessionToken, userId: returnedUserId } = await authResponse.json();
      saveSession(sessionToken);
      setUserId(returnedUserId);
      setSessionAddress(address);
      return true;
    } catch (err) {
      setError(categorizeError(err, walletName));
      console.error('Authentication error:', err);
      return false;
    }
  }, [walletName, address, hexAddress, signMessage]);

  const logout = useCallback(() => {
    clearSession();
    clearSessionCookie();
    setUserId(null);
    setSessionAddress(null);
    localStorage.removeItem(WALLET_NAME_KEY);
  }, []);

  const refreshDelegation = useCallback(() => {
    if (!address) return;
    try {
      const stakeAddr = resolveRewardAddress(address);
      if (stakeAddr) {
        fetch('/api/delegation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stakeAddress: stakeAddr }),
        })
          .then((r) => r.json())
          .then(({ drepId }) => {
            setDelegatedDrepId(drepId || null);
          })
          .catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, [address]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        walletName,
        connected,
        connecting,
        reconnecting,
        address,
        userId,
        sessionAddress,
        isAuthenticated,
        delegatedDrepId,
        ownDRepId,
        balanceAda,
        error,
        availableWallets,
        connectMethod,
        connect,
        disconnect,
        signMessage,
        authenticate,
        logout,
        clearError,
        refreshDelegation,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
