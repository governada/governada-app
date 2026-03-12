'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';
import { emitDiscoveryEvent } from '@/lib/discovery/events';

interface PageViewTrackerProps {
  event: string;
  properties?: Record<string, string | number | boolean | null>;
  /** Optional discovery event to emit alongside the analytics event */
  discoveryEvent?: string;
}

export function PageViewTracker({ event, properties, discoveryEvent }: PageViewTrackerProps) {
  useEffect(() => {
    posthog.capture(event, properties);
    if (discoveryEvent) {
      emitDiscoveryEvent(discoveryEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- properties is an object literal from parent; only event name matters for re-trigger
  }, [event, discoveryEvent]);

  return null;
}
