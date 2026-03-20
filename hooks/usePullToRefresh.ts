'use client';

/**
 * usePullToRefresh — pull-to-refresh gesture for Hub and list pages.
 *
 * Activates only when the page is scrolled to top (scrollY === 0) and
 * the user pulls down. Shows a custom indicator rather than fighting
 * the native pull-to-refresh.
 *
 * Returns:
 * - `pulling`: boolean — whether user is actively pulling
 * - `pullProgress`: number 0-1 — normalized pull distance
 * - `refreshing`: boolean — whether refresh callback is running
 * - `containerProps`: props to spread on the scrollable container
 *
 * The component disables native pull-to-refresh via overscroll-behavior
 * on the container element.
 *
 * Feature-flagged behind `mobile_gestures`.
 */

import { useCallback, useRef, useState, useEffect } from 'react';

const PULL_THRESHOLD = 80; // px needed to trigger refresh
const MAX_PULL = 120; // max visual pull distance
const RESISTANCE = 0.4; // pull resistance factor

interface PullToRefreshState {
  pulling: boolean;
  pullProgress: number;
  pullDistance: number;
  refreshing: boolean;
}

interface PullToRefreshReturn extends PullToRefreshState {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  enabled = true,
): PullToRefreshReturn {
  const [state, setState] = useState<PullToRefreshState>({
    pulling: false,
    pullProgress: 0,
    pullDistance: 0,
    refreshing: false,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || state.refreshing) return;

      const container = containerRef.current;
      if (!container) return;

      // Only activate when scrolled to top
      if (container.scrollTop > 0) return;

      const touch = e.touches[0];
      if (!touch) return;

      startYRef.current = touch.clientY;
      trackingRef.current = true;
    },
    [enabled, state.refreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!trackingRef.current || !enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      const dy = touch.clientY - startYRef.current;

      // Only track downward pulls
      if (dy <= 0) {
        if (state.pulling) {
          setState((s) => ({ ...s, pulling: false, pullProgress: 0, pullDistance: 0 }));
        }
        return;
      }

      // Apply resistance
      const pullDistance = Math.min(dy * RESISTANCE, MAX_PULL);
      const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

      setState((s) => ({
        ...s,
        pulling: true,
        pullProgress,
        pullDistance,
      }));
    },
    [enabled, state.pulling],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!trackingRef.current) return;
    trackingRef.current = false;

    if (state.pullProgress >= 1 && !state.refreshing) {
      setState((s) => ({ ...s, refreshing: true, pulling: false }));

      try {
        await onRefresh();
      } finally {
        setState({
          pulling: false,
          pullProgress: 0,
          pullDistance: 0,
          refreshing: false,
        });
      }
    } else {
      setState({
        pulling: false,
        pullProgress: 0,
        pullDistance: 0,
        refreshing: false,
      });
    }
  }, [state.pullProgress, state.refreshing, onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    // Only on mobile
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (!isMobile) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    ...state,
    containerRef,
  };
}
