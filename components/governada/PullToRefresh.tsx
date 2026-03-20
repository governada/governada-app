'use client';

/**
 * PullToRefresh — visual pull-to-refresh indicator for mobile.
 *
 * Wraps a scrollable container and shows a governance-themed spinner
 * when the user pulls down from the top. Uses the usePullToRefresh hook
 * for gesture detection.
 *
 * Disables native pull-to-refresh via overscroll-behavior: none.
 * Mobile only. Respects prefers-reduced-motion.
 * Feature-flagged behind `mobile_gestures`.
 */

import { type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  /** Async function to call on refresh */
  onRefresh: () => Promise<void>;
  /** Whether pull-to-refresh is enabled */
  enabled?: boolean;
  /** Container content */
  children: ReactNode;
  /** Additional classes on the scrollable container */
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  enabled = true,
  children,
  className,
}: PullToRefreshProps) {
  const { pulling, pullProgress, pullDistance, refreshing, containerRef } = usePullToRefresh(
    onRefresh,
    enabled,
  );
  const prefersReducedMotion = useReducedMotion();

  const showIndicator = pulling || refreshing;
  const indicatorOpacity = refreshing ? 1 : Math.min(pullProgress * 1.5, 1);
  const indicatorScale = refreshing ? 1 : 0.5 + pullProgress * 0.5;
  const rotation = prefersReducedMotion ? 0 : pullProgress * 360;

  return (
    <div className={cn('relative lg:hidden', className)}>
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="absolute left-0 right-0 flex justify-center pointer-events-none z-10"
          style={{ top: Math.max(pullDistance - 40, 8) }}
          aria-hidden="true"
        >
          <motion.div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'bg-background/90 backdrop-blur-sm border border-border/30 shadow-sm',
            )}
            style={{
              opacity: indicatorOpacity,
              scale: indicatorScale,
            }}
            animate={refreshing && !prefersReducedMotion ? { rotate: 360 } : { rotate: rotation }}
            transition={
              refreshing && !prefersReducedMotion
                ? { duration: 1, repeat: Infinity, ease: 'linear' }
                : { duration: 0 }
            }
          >
            <Loader2
              className={cn('h-4 w-4', refreshing ? 'text-primary' : 'text-muted-foreground')}
            />
          </motion.div>
        </div>
      )}

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className="overflow-y-auto overscroll-y-none h-full"
        style={{
          transform: pulling && !prefersReducedMotion ? `translateY(${pullDistance}px)` : undefined,
          transition: pulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
