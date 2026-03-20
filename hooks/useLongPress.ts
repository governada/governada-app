'use client';

/**
 * useLongPress — long-press detection for touch-optimized entity peek.
 *
 * Returns event handlers to attach to a pressable element.
 * After 300ms of continuous touch without movement, fires the callback.
 *
 * Cancels if:
 * - Touch moves more than 10px (prevents triggering during scroll)
 * - Touch ends before 300ms
 * - Context menu fires (prevents double-trigger)
 *
 * Feature-flagged behind `mobile_gestures`.
 */

import { useCallback, useRef } from 'react';

const LONG_PRESS_DELAY = 300;
const MOVE_TOLERANCE = 10;

interface LongPressHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useLongPress(onLongPress: () => void, enabled = true): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch) return;

      firedRef.current = false;
      startPosRef.current = { x: touch.clientX, y: touch.clientY };

      clear();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
        // Haptic feedback
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(15);
          }
        } catch {
          // silent
        }
      }, LONG_PRESS_DELAY);
    },
    [enabled, onLongPress, clear],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);

      if (dx > MOVE_TOLERANCE || dy > MOVE_TOLERANCE) {
        clear();
      }
    },
    [enabled, clear],
  );

  const onTouchEnd = useCallback(() => {
    clear();
  }, [clear]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // Prevent browser context menu when long-press fires
    if (firedRef.current) {
      e.preventDefault();
    }
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, onContextMenu };
}
