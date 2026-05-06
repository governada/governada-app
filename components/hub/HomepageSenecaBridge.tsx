'use client';

import { useEffect, useRef } from 'react';
import { posthog } from '@/lib/posthog';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import type { HomepageCinematicIdentity } from '@/stores/senecaThreadStore';
import type { PrioritizedQueue } from '@/types/cinematic';

interface HomepageSenecaBridgeProps {
  queue: PrioritizedQueue;
  identity: HomepageCinematicIdentity;
  autoOpenFirstVisit?: boolean;
}

const AUTO_OPEN_STATES = new Set(['first_visit_anonymous']);

export function HomepageSenecaBridge({
  queue,
  identity,
  autoOpenFirstVisit = true,
}: HomepageSenecaBridgeProps) {
  const setHomepageCinematic = useSenecaThreadStore((s) => s.setHomepageCinematic);
  const didAutoOpen = useRef(false);

  useEffect(() => {
    setHomepageCinematic({ queue, identity });
    return () => setHomepageCinematic(null);
  }, [identity, queue, setHomepageCinematic]);

  useEffect(() => {
    posthog.capture('seneca_interaction', {
      kind: 'cinema_state_chosen',
      state: queue.primary.state,
      reasoning: queue.meta.reasoning,
      primary_item_id: queue.primary.id,
    });
  }, [queue.meta.reasoning, queue.primary.id, queue.primary.state]);

  useEffect(() => {
    if (!autoOpenFirstVisit || didAutoOpen.current || !AUTO_OPEN_STATES.has(queue.primary.state)) {
      return;
    }

    didAutoOpen.current = true;
    const store = useSenecaThreadStore.getState();
    store.setMode('idle');
    store.setOpen(true);
    posthog.capture('seneca_interaction', {
      kind: 'panel_auto_opened',
      source: 'homepage_cinematic',
      state: queue.primary.state,
      reasoning: queue.meta.reasoning,
      primary_item_id: queue.primary.id,
    });
  }, [autoOpenFirstVisit, queue.meta.reasoning, queue.primary.id, queue.primary.state]);

  return null;
}
