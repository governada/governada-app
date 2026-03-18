'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { fetchClientFlags } from '@/lib/featureFlags';
import { useWallet } from '@/utils/wallet-context';

interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

let clientFlagCache: Record<string, boolean> | null = null;
let clientCachePromise: Promise<Record<string, boolean>> | null = null;
let cachedWalletAddress: string | null | undefined = undefined;

function getClientFlags(walletAddress?: string | null): Promise<Record<string, boolean>> {
  // Invalidate cache if wallet changed
  if (cachedWalletAddress !== walletAddress) {
    clientFlagCache = null;
    clientCachePromise = null;
    cachedWalletAddress = walletAddress;
  }

  if (clientFlagCache) return Promise.resolve(clientFlagCache);
  if (!clientCachePromise) {
    clientCachePromise = fetchClientFlags(walletAddress).then((flags) => {
      clientFlagCache = flags;
      setTimeout(() => {
        clientFlagCache = null;
        clientCachePromise = null;
      }, 60_000);
      return flags;
    });
  }
  return clientCachePromise;
}

/**
 * Client-side feature gate. Renders children only if the flag is enabled.
 * Automatically passes the connected wallet address for per-user targeting.
 * Shows nothing (or fallback) while loading or if flag is disabled.
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const { address } = useWallet();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getClientFlags(address).then((flags) => {
      setEnabled(flags[flag] ?? true);
    });
  }, [flag, address]);

  if (enabled === null) return null;
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Hook for checking a feature flag in client components.
 * Automatically passes the connected wallet address for per-user targeting.
 * Returns null while loading, then boolean.
 */
export function useFeatureFlag(flag: string): boolean | null {
  const { address } = useWallet();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getClientFlags(address).then((flags) => {
      setEnabled(flags[flag] ?? true);
    });
  }, [flag, address]);

  return enabled;
}
