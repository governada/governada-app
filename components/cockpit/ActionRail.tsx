'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useCockpitActions } from '@/hooks/useCockpitActions';
import { useCockpitStore } from '@/stores/cockpitStore';
import { ActionRailCard } from './ActionRailCard';

// ---------------------------------------------------------------------------
// Container animation variants
// ---------------------------------------------------------------------------

const railVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ActionRail — vertical strip on the left edge of the Cockpit homepage.
 *
 * Shows the top 5 most urgent governance action items. Each card can
 * trigger a globe fly-to on hover and navigates to the action on click.
 * Staggered entrance during boot cascade, with a calm "all caught up"
 * empty state.
 */
export function ActionRail() {
  const { items, isLoading } = useCockpitActions();
  const bootPhase = useCockpitStore((s) => s.bootPhase);
  const actionCompletions = useCockpitStore((s) => s.actionCompletions);
  const clearActionCompletion = useCockpitStore((s) => s.clearActionCompletion);
  const prefersReducedMotion = useReducedMotion();

  // Clear completion state after animation finishes
  const handleCompletionCleanup = useCallback(
    (actionId: string) => {
      const timer = setTimeout(() => {
        clearActionCompletion(actionId);
      }, 2000); // 1.5s animation + buffer
      return () => clearTimeout(timer);
    },
    [clearActionCompletion],
  );

  // Kick off cleanup timers for animating completions
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    for (const [id, status] of Object.entries(actionCompletions)) {
      if (status === 'animating') {
        cleanups.push(handleCompletionCleanup(id));
      }
    }
    return () => cleanups.forEach((fn) => fn());
  }, [actionCompletions, handleCompletionCleanup]);

  // Don't render until boot cascade reaches action-rail phase
  const isVisible = bootPhase === 'cascade' || bootPhase === 'ready';

  if (!isVisible || isLoading) return null;

  const shouldAnimate = !prefersReducedMotion;

  return (
    <motion.div
      variants={railVariants}
      initial={shouldAnimate ? 'hidden' : 'visible'}
      animate="visible"
      transition={shouldAnimate ? { duration: 0.5, ease: 'easeOut' } : { duration: 0 }}
      className="pointer-events-auto absolute left-4 top-[120px] z-30 flex flex-col gap-2"
    >
      <AnimatePresence mode="popLayout">
        {items.length === 0 ? (
          <motion.div
            key="empty-state"
            initial={shouldAnimate ? { opacity: 0, x: -20 } : { opacity: 1 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex w-64 items-center gap-3 rounded-lg border border-green-500/20 bg-black/50 px-3 py-3 backdrop-blur-md"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-[11px] text-muted-foreground">No actions need attention</p>
            </div>
          </motion.div>
        ) : (
          items.map((item, index) => (
            <ActionRailCard
              key={item.id}
              item={item}
              index={shouldAnimate ? index : 0}
              isCompleting={actionCompletions[item.id] === 'animating'}
            />
          ))
        )}
      </AnimatePresence>
    </motion.div>
  );
}
