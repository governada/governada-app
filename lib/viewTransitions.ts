/**
 * View Transitions API utility — wraps `document.startViewTransition()` with
 * direction logic for spatial navigation continuity.
 *
 * Direction logic:
 * - Deeper navigation (list -> detail): slide left
 * - Back navigation (detail -> list): slide right
 * - Sibling navigation (tab to tab): crossfade
 *
 * Progressive enhancement: browsers without View Transitions API support
 * get instant navigation with no degradation.
 */

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransitionDirection = 'forward' | 'backward' | 'sibling';

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Check if the browser supports the View Transitions API.
 * Safe to call on server (returns false).
 */
export function supportsViewTransitions(): boolean {
  if (typeof document === 'undefined') return false;
  return 'startViewTransition' in document;
}

// ---------------------------------------------------------------------------
// Direction inference
// ---------------------------------------------------------------------------

function pathDepth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

function pathBase(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] ?? '';
}

/**
 * Infer transition direction from current and target pathnames.
 */
export function inferTransitionDirection(
  currentPath: string,
  targetPath: string,
): TransitionDirection {
  const currentDepth = pathDepth(currentPath);
  const targetDepth = pathDepth(targetPath);

  // Deeper navigation: list -> detail
  if (targetDepth > currentDepth) return 'forward';

  // Shallower navigation: detail -> list
  if (targetDepth < currentDepth) return 'backward';

  // Same depth: check if within same section (sibling) or cross-section
  const currentBase = pathBase(currentPath);
  const targetBase = pathBase(targetPath);

  if (currentBase === targetBase) return 'sibling';

  // Different top-level sections at same depth — treat as sibling crossfade
  return 'sibling';
}

// ---------------------------------------------------------------------------
// CSS class management for direction-based animation
// ---------------------------------------------------------------------------

function setTransitionDirection(direction: TransitionDirection): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Remove all direction classes first
  root.classList.remove('vt-forward', 'vt-backward', 'vt-sibling');
  root.classList.add(`vt-${direction}`);
}

function clearTransitionDirection(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('vt-forward', 'vt-backward', 'vt-sibling');
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Navigate with a View Transition. Falls back to instant navigation
 * when the API is unsupported or the user prefers reduced motion.
 *
 * @param router - Next.js App Router instance
 * @param href - Target URL
 * @param direction - Optional explicit direction (auto-inferred if omitted)
 */
export function navigateWithTransition(
  router: AppRouterInstance,
  href: string,
  direction?: TransitionDirection,
): void {
  // Respect reduced motion preference
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    router.push(href);
    return;
  }

  // Fallback for unsupported browsers
  if (!supportsViewTransitions()) {
    router.push(href);
    return;
  }

  // Infer direction if not provided
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  const resolvedDirection = direction ?? inferTransitionDirection(currentPath, href);

  // Set direction class for CSS animations
  setTransitionDirection(resolvedDirection);

  // Start the view transition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transition = (document as any).startViewTransition(() => {
    router.push(href);
  });

  // Clean up direction class after transition completes
  transition.finished
    .then(() => clearTransitionDirection())
    .catch(() => clearTransitionDirection());
}
