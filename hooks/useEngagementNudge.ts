'use client';

/**
 * useEngagementNudge — time/depth tracking for anonymous wallet prompts.
 *
 * Triggers a nudge after 45s browsing or 3+ page views.
 * Caps at 3 lifetime impressions, 24h cooldown between dismissals.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  shouldShowNudge,
  recordPageView,
  markNudgeShown,
  markNudgeDismissed,
  markNudgeConverted,
  getDiscoveryState,
} from '@/lib/discovery/state';

const CHECK_INTERVAL_MS = 5_000; // Check every 5 seconds

export function useEngagementNudge() {
  const { segment } = useSegment();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const shownRef = useRef(false);

  // Only for anonymous users, not on homepage
  const isEligible = segment === 'anonymous' && pathname !== '/';

  // Track page views on navigation
  useEffect(() => {
    if (segment === 'anonymous') {
      recordPageView();
    }
  }, [pathname, segment]);

  // Periodic check for nudge trigger
  useEffect(() => {
    if (!isEligible || shownRef.current) return;

    const timer = setInterval(() => {
      if (shouldShowNudge()) {
        setShow(true);
        shownRef.current = true;
        markNudgeShown();
        clearInterval(timer);
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isEligible]);

  // Rotate through 3 content variants
  const state = getDiscoveryState();
  const variant = state.nudgeShownCount % 3;

  const dismiss = useCallback(() => {
    setShow(false);
    markNudgeDismissed();
  }, []);

  const convert = useCallback(() => {
    setShow(false);
    markNudgeConverted();
    // Trigger wallet connect via existing CustomEvent pattern
    window.dispatchEvent(new CustomEvent('openWalletConnect'));
  }, []);

  return {
    shouldShow: show,
    variant,
    dismiss,
    convert,
  };
}
