import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthogCapture = vi.hoisted(() => vi.fn());

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: posthogCapture },
}));

import { captureHomepageTiming, markHomepageViewed } from '@/lib/telemetry/perfMarks';

describe('homepage performance marks', () => {
  beforeEach(() => {
    posthogCapture.mockClear();
    performance.clearMarks();
  });

  it('captures each homepage timing event once after homepage_viewed is marked', () => {
    markHomepageViewed();

    captureHomepageTiming('time_to_interactive', { viewport: 'desktop' });
    captureHomepageTiming('time_to_interactive', { viewport: 'desktop' });

    expect(posthogCapture).toHaveBeenCalledTimes(1);
    expect(posthogCapture).toHaveBeenCalledWith(
      'time_to_interactive',
      expect.objectContaining({
        ms: expect.any(Number),
        viewport: 'desktop',
      }),
    );
  });

  it('does not capture homepage timing before the homepage view mark exists', () => {
    captureHomepageTiming('time_to_seneca_ready');

    expect(posthogCapture).not.toHaveBeenCalled();
  });
});
