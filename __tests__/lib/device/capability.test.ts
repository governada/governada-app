import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectMatchCapability, detectMatchCapabilityResult } from '@/lib/device/capability';

interface BrowserProbeOptions {
  reducedMotion?: boolean;
  reducedData?: boolean;
  deviceMemory?: number;
  webgl2?: boolean;
}

function installBrowserProbe({
  reducedMotion = false,
  reducedData = false,
  deviceMemory = 8,
  webgl2 = true,
}: BrowserProbeOptions = {}) {
  const remove = vi.fn();
  const getContext = vi.fn((kind: string) => (kind === 'webgl2' && webgl2 ? {} : null));
  const matchMedia = vi.fn((query: string) => ({
    matches:
      (query === '(prefers-reduced-motion: reduce)' && reducedMotion) ||
      (query === '(prefers-reduced-data: reduce)' && reducedData),
  }));
  const createElement = vi.fn(() => ({ getContext, remove }));

  vi.stubGlobal('window', { matchMedia });
  vi.stubGlobal('navigator', { deviceMemory });
  vi.stubGlobal('document', { createElement });

  return { createElement, getContext, matchMedia, remove };
}

describe('detectMatchCapability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('defaults SSR to Cerebro', () => {
    vi.stubGlobal('window', undefined);

    expect(detectMatchCapabilityResult()).toEqual({ capability: 'cerebro', reason: null });
  });

  it('routes reduced-motion users to the workspace fallback', () => {
    installBrowserProbe({ reducedMotion: true });

    expect(detectMatchCapabilityResult()).toEqual({
      capability: 'workspace_fallback',
      reason: 'reduced_motion',
    });
  });

  it('uses the low-memory and reduced-data AND gate for fallback', () => {
    installBrowserProbe({ deviceMemory: 3, reducedData: true });

    expect(detectMatchCapabilityResult()).toEqual({
      capability: 'workspace_fallback',
      reason: 'low_memory_reduced_data',
    });
  });

  it('keeps low-memory devices in Cerebro when reduced-data is not requested', () => {
    installBrowserProbe({ deviceMemory: 3, reducedData: false, webgl2: true });

    expect(detectMatchCapability()).toBe('cerebro');
  });

  it('routes missing WebGL2 support to fallback and removes the probe canvas', () => {
    const { remove } = installBrowserProbe({ webgl2: false });

    expect(detectMatchCapabilityResult()).toEqual({
      capability: 'workspace_fallback',
      reason: 'no_webgl2',
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('returns Cerebro on the happy path', () => {
    installBrowserProbe({ deviceMemory: 8, reducedData: false, webgl2: true });

    expect(detectMatchCapabilityResult()).toEqual({ capability: 'cerebro', reason: null });
  });
});
