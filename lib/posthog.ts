'use client';

import posthog from 'posthog-js';

let initialized = false;
const DEFAULT_POSTHOG_UI_HOST = 'https://us.posthog.com';

export function isDoNotTrackEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  const signal =
    window.navigator.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack ?? null;

  return signal === '1' || signal === 'yes';
}

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const uiHost = resolvePostHogUiHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);

  if (!key || isDoNotTrackEnabled()) return;

  posthog.init(key, {
    api_host: '/api/ph',
    ui_host: uiHost,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false,
  });

  initialized = true;
}

export { posthog };

export function resolvePostHogUiHost(configuredHost?: string): string {
  if (!configuredHost) return DEFAULT_POSTHOG_UI_HOST;

  try {
    const url = new URL(configuredHost);

    if (url.hostname.endsWith('.i.posthog.com')) {
      url.hostname = url.hostname.replace(/\.i\.posthog\.com$/u, '.posthog.com');
      return url.origin;
    }

    return url.origin;
  } catch {
    return DEFAULT_POSTHOG_UI_HOST;
  }
}
