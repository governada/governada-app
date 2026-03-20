'use client';

/**
 * useSwipeNavigation — horizontal swipe detection for section switching on mobile.
 *
 * Detects horizontal swipes on the main content area and navigates between
 * the three primary sections: Home, Governance, You.
 *
 * Constraints:
 * - Mobile only (touch events)
 * - Ignores swipes within scrollable containers
 * - Ignores vertical swipes (angle > 30 degrees)
 * - Minimum 80px horizontal distance
 * - Minimum 300px/s velocity
 * - Provides haptic feedback via navigator.vibrate if available
 * - Respects prefers-reduced-motion (disables haptic)
 *
 * Feature-flagged behind `mobile_gestures`.
 */

import { useCallback, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';

// Section order for left/right swipe navigation
const SECTIONS = ['/', '/governance', '/you'] as const;

/** Minimum horizontal distance in px to register a swipe */
const MIN_DISTANCE = 80;

/** Minimum velocity in px/s */
const MIN_VELOCITY = 300;

/** Maximum vertical/horizontal ratio (tan(30deg) ≈ 0.577) */
const MAX_ANGLE_RATIO = 0.577;

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  tracking: boolean;
}

/**
 * Returns the section index for the current pathname.
 * Falls back to -1 if not in a primary section.
 */
function getSectionIndex(pathname: string): number {
  if (pathname === '/') return 0;
  if (pathname.startsWith('/governance')) return 1;
  if (pathname.startsWith('/you')) return 2;
  return -1;
}

export function useSwipeNavigation(enabled: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const stateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    tracking: false,
  });

  const triggerHaptic = useCallback(() => {
    if (prefersReducedMotion) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // Haptic not available — silent fail
    }
  }, [prefersReducedMotion]);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      // Skip if touch starts in edge zone (reserved for EdgeSwipeMenu)
      if (touch.clientX < 20) return;

      // Skip if within a horizontally scrollable element
      const target = e.target as HTMLElement;
      if (target.closest('[data-swipe-ignore]')) return;

      stateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        tracking: true,
      };
    },
    [enabled],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !stateRef.current.tracking) return;
      stateRef.current.tracking = false;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - stateRef.current.startX;
      const dy = touch.clientY - stateRef.current.startY;
      const dt = (Date.now() - stateRef.current.startTime) / 1000; // seconds

      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Must be primarily horizontal
      if (absDy / absDx > MAX_ANGLE_RATIO) return;

      // Must meet minimum distance
      if (absDx < MIN_DISTANCE) return;

      // Must meet minimum velocity
      if (dt === 0 || absDx / dt < MIN_VELOCITY) return;

      const currentIndex = getSectionIndex(pathname);
      if (currentIndex === -1) return;

      // Swipe left (negative dx) = next section, swipe right = previous
      const direction = dx < 0 ? 1 : -1;
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= SECTIONS.length) return;

      triggerHaptic();
      router.push(SECTIONS[nextIndex]);
    },
    [enabled, pathname, router, triggerHaptic],
  );

  useEffect(() => {
    if (!enabled) return;

    // Only activate on mobile (touch devices)
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (!isMobile) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchEnd]);
}
