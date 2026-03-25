'use client';

/**
 * useHapticFeedback — Thin wrapper around the Vibration API.
 *
 * Provides tactile feedback patterns for mobile interactions.
 * Degrades silently on devices without vibration support.
 */

export function useHapticFeedback() {
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  return {
    /** Light tap — input focus, selection */
    tick: () => canVibrate && navigator.vibrate(50),
    /** Confirmation — successful action */
    confirm: () => canVibrate && navigator.vibrate([50, 50, 100]),
    /** Celebration — milestone, achievement */
    celebrate: () => canVibrate && navigator.vibrate([50, 30, 50, 30, 100, 50, 150]),
  };
}
