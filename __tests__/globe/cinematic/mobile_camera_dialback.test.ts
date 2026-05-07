import { describe, expect, it, vi } from 'vitest';
import {
  mobileAdjustCamera,
  mobileAdjustFocusOptions,
  pathIntersectsBoundingSphere,
} from '@/lib/globe/behaviors/cinematic/shared';
import { createFirstVisitAnonymousBehavior } from '@/lib/globe/behaviors/cinematic/firstVisitAnonymousBehavior';
import { makeCinemaCommand, makeCtx } from './testUtils';

function mockMobileViewport() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    },
  });
}

describe('mobile camera dial-back', () => {
  it('halves cinematic traversal from the neutral distance and clamps transition duration', () => {
    const adjusted = mobileAdjustCamera(
      {
        type: 'cinematic',
        state: {
          dollyTarget: 20,
          transitionDuration: 2.4,
        },
      },
      'mobile',
    );

    expect(adjusted).toEqual({
      type: 'cinematic',
      state: {
        dollyTarget: 17,
        transitionDuration: 1.5,
      },
    });
  });

  it('detects fly-through paths through non-target bounding spheres', () => {
    expect(pathIntersectsBoundingSphere([0, 0, 0], [10, 0, 0], [5, 0, 0], 0.75)).toBe(true);
    expect(pathIntersectsBoundingSphere([0, 0, 0], [10, 0, 0], [5, 3, 0], 0.75)).toBe(false);
  });

  it('routes mobile fly-to-position commands around intersecting non-target nodes', () => {
    const adjusted = mobileAdjustCamera(
      {
        type: 'flyToPosition',
        target: [10, 0, 0],
        distance: 10,
        duration: 2.2,
      },
      'mobile',
      {
        origin: [0, 0, 0],
        targetNodeId: 'target',
        nodes: [{ id: 'bystander', position: [5, 0, 0], radius: 1 }],
      },
    );

    expect(adjusted.type).toBe('flyToPosition');
    if (adjusted.type !== 'flyToPosition') return;
    expect(adjusted.target).not.toEqual([10, 0, 0]);
    expect(adjusted.distance).toBe(12);
    expect(adjusted.duration).toBe(1.5);
  });

  it('dials back focus proximity on mobile', () => {
    expect(mobileAdjustFocusOptions({ proximity: 'tight' }, 'mobile')).toEqual({
      proximity: 'cluster',
      transitionDuration: 1.5,
    });
    expect(mobileAdjustFocusOptions({ proximity: 'cluster' }, 'mobile')).toEqual({
      proximity: 'overview',
      transitionDuration: 1.5,
    });
  });

  it('applies the helper through a representative cinematic behavior', () => {
    mockMobileViewport();
    const ctx = makeCtx();

    createFirstVisitAnonymousBehavior().execute(makeCinemaCommand('first_visit_anonymous'), ctx);

    expect(ctx.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cinematic',
        state: expect.objectContaining({ dollyTarget: 16.5, transitionDuration: 1.5 }),
      }),
    );
  });
});
