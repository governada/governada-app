'use client';

import type { Properties } from 'posthog-js';
import { isDoNotTrackEnabled, posthog } from '@/lib/posthog';

const SENECA_DISTINCT_ID_KEY = 'governada.seneca.distinct_id';

export function captureSenecaInteraction(properties: Properties): void {
  if (typeof window === 'undefined' || isDoNotTrackEnabled()) return;

  const token = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!token) return;

  const distinctId = getDistinctId();
  const payload = JSON.stringify({
    api_key: token,
    event: 'seneca_interaction',
    properties: {
      ...properties,
      token,
      distinct_id: distinctId,
      $current_url: window.location.href,
      $host: window.location.host,
      $pathname: window.location.pathname,
    },
  });

  void fetch('/api/ph/capture/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

function getDistinctId(): string {
  try {
    const sdkDistinctId = posthog.get_distinct_id?.();
    if (sdkDistinctId) return sdkDistinctId;
  } catch {
    // Fall back to a Seneca-local anonymous id when the SDK has not initialized yet.
  }

  try {
    const existing = window.localStorage.getItem(SENECA_DISTINCT_ID_KEY);
    if (existing) return existing;

    const next =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `seneca-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(SENECA_DISTINCT_ID_KEY, next);
    return next;
  } catch {
    return `seneca-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
