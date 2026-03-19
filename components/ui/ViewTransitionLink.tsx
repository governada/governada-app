'use client';

/**
 * ViewTransitionLink — A link component that triggers View Transitions API
 * animations when navigating between pages.
 *
 * Wraps Next.js Link with automatic direction detection based on pathname
 * depth comparison. Falls back to regular Link behavior when the View
 * Transitions API is unsupported.
 *
 * Usage:
 *   <ViewTransitionLink href="/proposal/123">View Proposal</ViewTransitionLink>
 *   <ViewTransitionLink href="/governance" direction="backward">Back</ViewTransitionLink>
 */

import React, { useCallback, type AnchorHTMLAttributes } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  supportsViewTransitions,
  inferTransitionDirection,
  navigateWithTransition,
  type TransitionDirection,
} from '@/lib/viewTransitions';
import { useFeatureFlag } from '@/components/FeatureGate';

interface ViewTransitionLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  /** Explicit transition direction. Auto-detected from pathname depth if omitted. */
  direction?: TransitionDirection;
  /** Forward ref support */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Prefetch (passed to Next.js Link) */
  prefetch?: boolean;
}

export function ViewTransitionLink({
  href,
  direction,
  children,
  className,
  prefetch,
  onClick,
  ...rest
}: ViewTransitionLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const viewTransitionsEnabled = useFeatureFlag('view_transitions');

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Run any existing onClick handler
      onClick?.(e);

      // Don't intercept if default was prevented, or modifier keys held (new tab, etc.)
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      // Skip if feature flag is off or API unsupported
      if (!viewTransitionsEnabled || !supportsViewTransitions()) {
        return;
      }

      // Respect reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      // Prevent default navigation — we'll handle it with View Transitions
      e.preventDefault();

      const resolvedDirection = direction ?? inferTransitionDirection(pathname, href);
      navigateWithTransition(router, href, resolvedDirection);
    },
    [onClick, viewTransitionsEnabled, direction, pathname, href, router],
  );

  return (
    <Link href={href} className={className} prefetch={prefetch} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
