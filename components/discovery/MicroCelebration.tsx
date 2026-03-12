'use client';

/**
 * MicroCelebration — Lightweight toast-like milestone popup.
 *
 * Lighter than CitizenMilestoneCelebration (no confetti, no share).
 * Shows a small amber-bordered toast with icon + label + description.
 * Auto-dismisses after 4 seconds. Plays milestone chime if sound enabled.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { spring } from '@/lib/animations';
import { playMilestoneChime } from '@/lib/sounds';
import { posthog } from '@/lib/posthog';
import type { DiscoveryMilestone } from '@/lib/discovery/milestones';

interface MicroCelebrationProps {
  milestone: DiscoveryMilestone | null;
  onDismiss: () => void;
}

export function MicroCelebration({ milestone, onDismiss }: MicroCelebrationProps) {
  const shouldReduceMotion = useReducedMotion();
  const chimedRef = useRef<string | null>(null);

  // Play chime + track on new milestone
  useEffect(() => {
    if (!milestone || chimedRef.current === milestone.id) return;
    chimedRef.current = milestone.id;
    playMilestoneChime();
    posthog.capture('discovery_milestone_shown', { milestone_id: milestone.id });
  }, [milestone]);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!milestone) return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [milestone, onDismiss]);

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          key={milestone.id}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={spring.bouncy}
          className="fixed bottom-24 sm:bottom-8 left-4 sm:left-auto sm:right-4 z-40 w-[300px] max-w-[calc(100vw-2rem)]"
        >
          <div className="rounded-xl border border-amber-500/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/15 shrink-0">
                <Trophy className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-500">Milestone Unlocked</p>
                <p className="text-sm font-semibold mt-0.5">{milestone.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {milestone.description}
                </p>
              </div>
              <button
                onClick={onDismiss}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
