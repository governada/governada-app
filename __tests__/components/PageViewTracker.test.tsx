import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const posthogCapture = vi.hoisted(() => vi.fn());

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: posthogCapture },
}));

vi.mock('@/lib/discovery/events', () => ({
  emitDiscoveryEvent: vi.fn(),
}));

import { PageViewTracker } from '@/components/PageViewTracker';
import { HOMEPAGE_VIEWED_MARK } from '@/lib/telemetry/perfMarks';

describe('PageViewTracker homepage timing', () => {
  beforeEach(() => {
    posthogCapture.mockClear();
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    });
    performance.clearMarks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('marks homepage_viewed as the start of homepage performance timing', async () => {
    render(<PageViewTracker event="homepage_viewed" />);

    await waitFor(() => {
      expect(performance.getEntriesByName(HOMEPAGE_VIEWED_MARK, 'mark')).toHaveLength(1);
    });
    expect(posthogCapture).toHaveBeenCalledWith(
      'first_visit',
      expect.objectContaining({ source: 'homepage' }),
    );
    expect(posthogCapture).toHaveBeenCalledWith('homepage_viewed', undefined);
  });
});
