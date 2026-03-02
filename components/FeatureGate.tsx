'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { fetchClientFlags } from '@/lib/featureFlags';

interface FeatureGateProps {
  flag: string;
  children: ReactNode;
  fallback?: ReactNode;
}

let clientFlagCache: Record<string, boolean> | null = null;
let clientCachePromise: Promise<Record<string, boolean>> | null = null;

function getClientFlags(): Promise<Record<string, boolean>> {
  if (clientFlagCache) return Promise.resolve(clientFlagCache);
  if (!clientCachePromise) {
    clientCachePromise = fetchClientFlags().then(flags => {
      clientFlagCache = flags;
      setTimeout(() => { clientFlagCache = null; clientCachePromise = null; }, 60_000);
      return flags;
    });
  }
  return clientCachePromise;
}

/**
 * Client-side feature gate. Renders children only if the flag is enabled.
 * Shows nothing (or fallback) while loading or if flag is disabled.
 */
export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getClientFlags().then(flags => {
      setEnabled(flags[flag] ?? true);
    });
  }, [flag]);

  if (enabled === null) return null;
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Hook for checking a feature flag in client components.
 * Returns null while loading, then boolean.
 */
export function useFeatureFlag(flag: string): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    getClientFlags().then(flags => {
      setEnabled(flags[flag] ?? true);
    });
  }, [flag]);

  return enabled;
}
