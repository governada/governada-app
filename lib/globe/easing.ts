/**
 * Easing functions for globe focus transitions.
 *
 * Each takes t in [0, 1] and returns an eased value in [0, 1].
 */

import type { EasingCurve } from './types';

export function applyEasing(t: number, curve: EasingCurve): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (curve) {
    case 'ease-in-out':
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
    case 'ease-out':
      return 1 - Math.pow(1 - clamped, 3);
    case 'spring': {
      // Damped spring: slight overshoot, then settle
      const c4 = (2 * Math.PI) / 3;
      return clamped === 0
        ? 0
        : clamped === 1
          ? 1
          : Math.pow(2, -10 * clamped) * Math.sin((clamped * 10 - 0.75) * c4) + 1;
    }
    case 'linear':
    default:
      return clamped;
  }
}
