/**
 * focusState — Window-level shared focus state for R3F cross-reconciler bridge.
 *
 * R3F's <Canvas> creates a separate React reconciler tree. Components inside it
 * don't re-render when parent state changes. Module-level variables can be
 * duplicated by bundler chunk splitting. Window globals are truly shared —
 * no boundary issues possible.
 *
 * This is a small, stable module that rarely changes.
 */

import type { FocusState } from './types';
import { DEFAULT_FOCUS } from './types';

const FOCUS_KEY = '__globeFocusState' as const;
const FOCUS_VER_KEY = '__globeFocusVersion' as const;

/** Read the current shared focus state (SSR-safe) */
export function getSharedFocus(): FocusState {
  if (typeof window === 'undefined') return DEFAULT_FOCUS;
  return ((window as unknown as Record<string, unknown>)[FOCUS_KEY] as FocusState) ?? DEFAULT_FOCUS;
}

/** Write a new focus state to the shared window global and bump version */
export function setSharedFocus(focus: FocusState): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  w[FOCUS_KEY] = focus;
  w[FOCUS_VER_KEY] = ((w[FOCUS_VER_KEY] as number) ?? 0) + 1;
}

/** Read the focus version counter (used by useFrame to detect changes) */
export function getSharedFocusVersion(): number {
  if (typeof window === 'undefined') return 0;
  return ((window as unknown as Record<string, unknown>)[FOCUS_VER_KEY] as number) ?? 0;
}
