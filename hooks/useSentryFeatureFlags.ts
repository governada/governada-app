'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { fetchClientFlags } from '@/lib/featureFlags';

/**
 * Loads feature flags and sets them as Sentry context.
 * Re-fetches when the tab regains focus (visibilitychange).
 */
export function useSentryFeatureFlags() {
  useEffect(() => {
    function syncFlags() {
      void fetchClientFlags().then((flags) => {
        Sentry.setContext('featureFlags', flags);
      });
    }

    // Initial load
    syncFlags();

    // Re-fetch when tab becomes visible again
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        syncFlags();
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
