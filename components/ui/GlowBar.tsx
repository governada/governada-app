'use client';

import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlowBarProps {
  /** Fill percentage 0-100 */
  value: number;
  /** Tailwind gradient/color classes for the fill */
  fillClass: string;
  /** Hex color for the glow effect (e.g., '#22c55e') */
  glowColor: string;
  /** Height in pixels (default 10) */
  height?: number;
  /** Whether to animate width from 0 on first view (default true) */
  animate?: boolean;
  /** Additional class for the outer container */
  className?: string;
}

/**
 * Branded progress bar with glow halo and glass highlight.
 * Replaces generic Tailwind div-bars across the app with a
 * consistent Governada visual treatment.
 */
export function GlowBar({
  value,
  fillClass,
  glowColor,
  height = 10,
  animate = true,
  className,
}: GlowBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });
  const pct = Math.min(100, Math.max(0, value));
  const show = !animate || isInView;

  return (
    <div ref={ref} className={cn('relative w-full', className)} style={{ height }}>
      {/* Track */}
      <div className="absolute inset-0 rounded-full bg-muted/30" />

      {/* Fill with glow */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
          fillClass,
        )}
        style={{
          width: show ? `${pct}%` : '0%',
          boxShadow:
            show && pct > 0
              ? `0 0 ${height}px ${glowColor}50, 0 0 ${height * 2}px ${glowColor}20`
              : 'none',
        }}
      >
        {/* Glass highlight */}
        <div className="absolute inset-x-0 top-0 h-[40%] rounded-t-full bg-white/[0.12]" />
      </div>
    </div>
  );
}
