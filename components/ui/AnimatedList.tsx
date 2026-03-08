'use client';

import { type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import { staggerContainer, fadeInUp } from '@/lib/animations';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  /** Parent container variants (default: staggerContainer) */
  container?: Variants;
  /** Per-item variants (default: fadeInUp) */
  item?: Variants;
  /** Animate only when scrolled into view */
  inView?: boolean;
}

/**
 * Thin wrapper that staggers its children into view.
 * Each direct child should be a motion-compatible element
 * or wrapped in <motion.div variants={item}>.
 */
export function AnimatedList({
  children,
  className,
  container = staggerContainer,
  inView = false,
}: AnimatedListProps) {
  const viewProps = inView
    ? {
        initial: 'hidden' as const,
        whileInView: 'visible' as const,
        viewport: { once: true, margin: '-40px' as const },
      }
    : { initial: 'hidden' as const, animate: 'visible' as const };

  return (
    <motion.div className={className} variants={container} {...viewProps}>
      {children}
    </motion.div>
  );
}

/** Convenience wrapper for each child inside AnimatedList */
export function AnimatedItem({
  children,
  className,
  variants = fadeInUp,
}: {
  children: ReactNode;
  className?: string;
  variants?: Variants;
}) {
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
