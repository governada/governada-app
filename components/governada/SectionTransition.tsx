'use client';

/**
 * SectionTransition — wraps page content with a subtle fade when the user
 * navigates between the Four Worlds (Home, Workspace, Governance, You).
 *
 * Uses framer-motion AnimatePresence keyed on the current section so that
 * intra-section navigation (e.g., Proposals → Representatives) is instant
 * but cross-section navigation (Home → Governance) gets a 150ms fade.
 *
 * Respects prefers-reduced-motion.
 */

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getCurrentSection } from '@/lib/nav/config';

export function SectionTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const section = getCurrentSection(pathname) ?? 'other';

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={section}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
