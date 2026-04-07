'use client';

import posthog from 'posthog-js';

let initialized = false;

export function isDoNotTrackEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  const signal =
    window.navigator.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack ?? null;

  return signal === '1' || signal === 'yes';
}

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!key || isDoNotTrackEnabled()) return;

  posthog.init(key, {
    api_host: host,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
  });

  initialized = true;
}

export { posthog };
