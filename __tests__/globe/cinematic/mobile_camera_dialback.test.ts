import { describe, expect, it, vi } from 'vitest';
import {
  focusNodes,
  mobileAdjustCamera,
  mobileAdjustFocusOptions,
  pathIntersectsBoundingSphere,
} from '@/lib/globe/behaviors/cinematic/shared';
import { createFirstVisitAnonymousBehavior } from '@/lib/globe/behaviors/cinematic/firstVisitAnonymousBehavior';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';
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
    const tight = mobileAdjustFocusOptions({ proximity: 'tight' }, 'mobile', 1);
    expect(tight.proximity).toBe('cluster');
    expect(tight.cameraDistanceOverride).toBe(9.5);
    expect(tight.transitionDuration).toBe(1.5);

    const cluster = mobileAdjustFocusOptions({ proximity: 'cluster' }, 'mobile', 10);
    expect(cluster.proximity).toBe('overview');
    expect(cluster.cameraDistanceOverride).toBeCloseTo(9.333, 3);
    expect(cluster.transitionDuration).toBe(1.5);
  });

  it('applies mobile distance override through focus-based cinema intent', () => {
    mockMobileViewport();
    setSharedIntent({ focusedIds: null });

    focusNodes(['proposal-abcdef123456-0'], { proximity: 'tight', pulse: true });

    const intent = getSharedIntent();
    expect(intent.cameraProximity).toBe('cluster');
    expect(intent.cameraDistanceOverride).toBe(9.5);
    expect(intent.transitionDuration).toBe(1.5);
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
