'use client';

/**
 * PageTransition — Lightweight page content entry animation wrapper.
 *
 * Wraps page content with a subtle translateY(8px -> 0) + opacity(0 -> 1)
 * animation on mount. Duration: 200ms.
 *
 * Respects `prefers-reduced-motion` — renders children instantly when
 * the user prefers reduced motion.
 *
 * This is distinct from the route-level `components/PageTransition.tsx`
 * which handles directional Framer Motion transitions in template.tsx.
 * This component is for wrapping individual page content sections.
 *
 * Usage:
 *   <PageTransition>
 *     <h1>Page Title</h1>
 *     <div>Content...</div>
 *   </PageTransition>
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Delay in seconds before the animation starts */
  delay?: number;
}

const entryVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export function PageContentTransition({ children, className, delay = 0 }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      variants={entryVariants}
      initial="hidden"
      animate="visible"
      transition={{
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1],
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
