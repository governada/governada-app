import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createInitialDeviceCapability, probeDeviceCapability } from '@/hooks/useDeviceCapability';

describe('useDeviceCapability helpers', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextType: any) => {
      if (contextType !== 'webgl') return null;

      return {
        MAX_TEXTURE_SIZE: 0x0d33,
        getExtension: (name: string) =>
          name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null,
        getParameter: (param: number) => {
          if (param === 0x9246) return 'NVIDIA GeForce';
          if (param === 0x0d33) return 8192;
          return null;
        },
      } as any;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in the 2D fallback before the browser probe runs', () => {
    expect(createInitialDeviceCapability()).toMatchObject({
      gpuTier: 'mid',
      use2D: true,
    });
  });

  it('upgrades the probe result to 3D on capable hardware', () => {
    expect(probeDeviceCapability()).toMatchObject({
      gpuTier: 'high',
      use2D: false,
      isMobile: false,
    });
  });
});
