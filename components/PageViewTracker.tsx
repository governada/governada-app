'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';

interface PageViewTrackerProps {
  event: string;
  properties?: Record<string, string | number | boolean | null>;
}

export function PageViewTracker({ event, properties }: PageViewTrackerProps) {
  useEffect(() => {
    posthog.capture(event, properties);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- properties is an object literal from parent; only event name matters for re-trigger
  }, [event]);

  return null;
}
