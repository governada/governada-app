'use client';

import { posthog } from '@/lib/posthog';

export const HOMEPAGE_VIEWED_MARK = 'governada.homepage.viewed';
export const HOMEPAGE_MOUNT_MARK = 'governada.homepage.mount';

const emittedTimingEvents = new Set<string>();

type TimingProperties = Record<string, string | number | boolean | null | undefined>;

export function markHomepageViewed(): void {
  const perf = getPerformance();
  if (!perf?.mark) return;

  emittedTimingEvents.clear();
  clearMark(perf, HOMEPAGE_VIEWED_MARK);
  clearMark(perf, HOMEPAGE_MOUNT_MARK);
  perf.mark(HOMEPAGE_VIEWED_MARK);
  perf.mark(HOMEPAGE_MOUNT_MARK);
}

export function hasHomepageViewedMark(): boolean {
  return latestMarkStart(HOMEPAGE_VIEWED_MARK) !== null;
}

export function captureHomepageTiming(
  event: 'time_to_interactive' | 'time_to_seneca_ready' | 'time_to_cinema_fire',
  properties: TimingProperties = {},
  options: { startMark?: string } = {},
): void {
  if (emittedTimingEvents.has(event)) return;

  const perf = getPerformance();
  if (!perf?.now || !hasHomepageViewedMark()) return;

  const startMark = options.startMark ?? HOMEPAGE_VIEWED_MARK;
  const start = latestMarkStart(startMark) ?? latestMarkStart(HOMEPAGE_MOUNT_MARK);
  if (start === null) return;

  emittedTimingEvents.add(event);
  // PostHog payload: { ms, ...small contextual properties }.
  posthog.capture(event, {
    ms: Math.max(0, Math.round(perf.now() - start)),
    ...properties,
  });
}

function getPerformance(): Performance | null {
  if (typeof window !== 'undefined' && window.performance) return window.performance;
  if (typeof performance !== 'undefined') return performance;
  return null;
}

function latestMarkStart(name: string): number | null {
  const perf = getPerformance();
  const entries = perf?.getEntriesByName?.(name, 'mark') ?? [];
  const latest = entries[entries.length - 1];
  return typeof latest?.startTime === 'number' ? latest.startTime : null;
}

function clearMark(perf: Performance, name: string): void {
  try {
    perf.clearMarks(name);
  } catch {
    // Some test/browser shims expose mark() without clearMarks().
  }
}
