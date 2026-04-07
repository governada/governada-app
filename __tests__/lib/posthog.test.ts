import { beforeEach, describe, expect, it, vi } from 'vitest';

const initMock = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    init: initMock,
  },
}));

describe('posthog bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    initMock.mockReset();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('does not initialize when no key is configured', async () => {
    const { initPostHog } = await import('@/lib/posthog');

    globalThis.window = { navigator: { doNotTrack: '0' } } as Window & typeof globalThis;
    initPostHog();

    expect(initMock).not.toHaveBeenCalled();
  });

  it('initializes when configured and Do Not Track is not enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'ph_test_key');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://example.posthog.test');

    const { initPostHog } = await import('@/lib/posthog');

    globalThis.window = { navigator: { doNotTrack: '0' } } as Window & typeof globalThis;
    initPostHog();

    expect(initMock).toHaveBeenCalledWith('ph_test_key', {
      api_host: 'https://example.posthog.test',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
    });
  });

  it('skips initialization when Do Not Track is enabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'ph_test_key');

    const { initPostHog } = await import('@/lib/posthog');

    globalThis.window = { navigator: { doNotTrack: '1' } } as Window & typeof globalThis;
    initPostHog();

    expect(initMock).not.toHaveBeenCalled();
  });
});
