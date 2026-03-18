'use client';

import { useEffect, useRef } from 'react';
import { useSegment } from '@/components/providers/SegmentProvider';
import * as Sentry from '@sentry/nextjs';
import { isPreviewAddress } from '@/lib/preview';

/**
 * Syncs SegmentProvider state to Sentry user context and tags.
 * Hashes stakeAddress with SHA-256 (truncated to 16 hex chars) for privacy.
 */
async function hashAddress(address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(address);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 16);
}

export function useSentryContext() {
  const {
    segment,
    realSegment,
    stakeAddress,
    drepId,
    poolId,
    delegatedDrep,
    delegatedPool,
    tier,
    isViewingAs,
    dimensionOverrides,
  } = useSegment();

  const lastHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stakeAddress) {
      // Disconnected — clear user context
      lastHashRef.current = null;
      Sentry.setUser(null);
      Sentry.setTag('segment', 'anonymous');
      Sentry.setTag('tier', undefined);
      Sentry.setTag('isViewingAs', undefined);
      Sentry.setContext('governance', null);
      return;
    }

    // Hash the stake address and set Sentry context
    let cancelled = false;

    void hashAddress(stakeAddress).then((hashedAddress) => {
      if (cancelled) return;

      lastHashRef.current = hashedAddress;

      Sentry.setUser({ id: hashedAddress });
      Sentry.setTag('segment', segment);
      Sentry.setTag('tier', tier ?? 'none');
      Sentry.setTag('isViewingAs', String(isViewingAs));
      // Preview mode context
      const isPreview = isPreviewAddress(stakeAddress);
      if (isPreview) {
        Sentry.setTag('isPreview', 'true');
      }

      Sentry.setContext('governance', {
        segment,
        realSegment,
        drepId,
        poolId,
        delegatedDrep,
        delegatedPool,
        tier,
        isViewingAs,
        isPreview,
        engagementLevel: dimensionOverrides.engagementLevel ?? null,
        credibilityTier: dimensionOverrides.credibilityTier ?? null,
        governanceLevel: dimensionOverrides.governanceLevel ?? null,
        governanceDepth: dimensionOverrides.governanceDepth ?? null,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    stakeAddress,
    segment,
    realSegment,
    drepId,
    poolId,
    delegatedDrep,
    delegatedPool,
    tier,
    isViewingAs,
    dimensionOverrides,
  ]);
}
