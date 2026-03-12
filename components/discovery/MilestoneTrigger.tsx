'use client';

/**
 * MilestoneTrigger — Headless component that listens for discovery events
 * and queues milestone celebrations.
 *
 * Listens on the discovery event bus. When an event matches a milestone
 * that hasn't been celebrated yet, it queues it for MicroCelebration.
 * Shows one celebration at a time.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { onDiscoveryEvent } from '@/lib/discovery/events';
import { DISCOVERY_MILESTONES, type DiscoveryMilestone } from '@/lib/discovery/milestones';
import {
  shouldCelebrateMilestone,
  markMilestoneCelebrated,
  getDiscoveryState,
  markSectionVisited,
} from '@/lib/discovery/state';
import { usePathname } from 'next/navigation';
import { MicroCelebration } from './MicroCelebration';

export function MilestoneTrigger() {
  const [queue, setQueue] = useState<DiscoveryMilestone[]>([]);
  const [active, setActive] = useState<DiscoveryMilestone | null>(null);
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);

  // Track section visits and emit sections_3 event
  useEffect(() => {
    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    // Map pathname to section
    const section = pathname.startsWith('/governance')
      ? 'governance'
      : pathname.startsWith('/workspace')
        ? 'workspace'
        : pathname.startsWith('/you')
          ? 'you'
          : pathname.startsWith('/help')
            ? 'help'
            : pathname.startsWith('/match')
              ? 'match'
              : pathname === '/'
                ? 'hub'
                : null;

    if (!section) return;
    markSectionVisited(section);

    // Check if 3+ sections visited
    const state = getDiscoveryState();
    if (state.sectionsVisited.length >= 3) {
      // Emit the sections_3 event manually for the milestone
      const milestone = DISCOVERY_MILESTONES.find((m) => m.triggerEvent === 'sections_3');
      if (milestone && shouldCelebrateMilestone(milestone.id)) {
        markMilestoneCelebrated(milestone.id);
        setQueue((q) => [...q, milestone]);
      }
    }
  }, [pathname]);

  // Listen for all milestone-triggering events
  useEffect(() => {
    const unsubscribers = DISCOVERY_MILESTONES.filter((m) => m.triggerEvent !== 'sections_3').map(
      (milestone) =>
        onDiscoveryEvent(milestone.triggerEvent, () => {
          if (shouldCelebrateMilestone(milestone.id)) {
            markMilestoneCelebrated(milestone.id);
            setQueue((q) => [...q, milestone]);
          }
        }),
    );

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  // Show next queued milestone when active clears
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
  }, [active, queue]);

  const handleDismiss = useCallback(() => {
    setActive(null);
  }, []);

  return <MicroCelebration milestone={active} onDismiss={handleDismiss} />;
}
