import { describe, it, expect } from 'vitest';
import {
  deriveCameraDistance,
  deriveTransitionSpeed,
  deriveOrbitSpeed,
  resolveAlignmentTopN,
  computeFocusCentroid,
  deriveFromIntent,
} from '@/lib/globe/focusEngine';
import { DEFAULT_FOCUS, DEFAULT_ROTATION_SPEED } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeNode(
  id: string,
  nodeType: string,
  alignments: number[],
  position: [number, number, number] = [0, 0, 0],
): ConstellationNode3D {
  return {
    id,
    nodeType,
    label: id,
    alignments,
    position,
    activity: 0.5,
    clusterId: null,
    neighbors: [],
  } as unknown as ConstellationNode3D;
}

function makeDreps(count: number): ConstellationNode3D[] {
  return Array.from({ length: count }, (_, i) =>
    makeNode(
      `drep-${i}`,
      'drep',
      [50, 50, 50, 50, 50, 50],
      [Math.cos((i / count) * Math.PI * 2) * 5, Math.sin((i / count) * Math.PI * 2) * 5, 0],
    ),
  );
}

// ---------------------------------------------------------------------------
// deriveCameraDistance
// ---------------------------------------------------------------------------

describe('deriveCameraDistance', () => {
  it('returns max distance for 0 focused nodes', () => {
    expect(deriveCameraDistance(0)).toBe(14);
  });

  it('returns tight distance for 1-4 nodes', () => {
    const d = deriveCameraDistance(3);
    expect(d).toBeGreaterThanOrEqual(3);
    expect(d).toBeLessThanOrEqual(4);
  });

  it('returns cluster distance for 20-100 nodes', () => {
    const d = deriveCameraDistance(50);
    expect(d).toBeGreaterThanOrEqual(6);
    expect(d).toBeLessThanOrEqual(10);
  });

  it('returns overview distance for 500+ nodes', () => {
    const d = deriveCameraDistance(600);
    expect(d).toBeGreaterThanOrEqual(13);
    expect(d).toBeLessThanOrEqual(15);
  });

  it('respects explicit proximity override', () => {
    expect(deriveCameraDistance(500, 'locked')).toBe(3.5);
    expect(deriveCameraDistance(500, 'tight')).toBe(5);
  });

  it('increases monotonically with focus count', () => {
    const counts = [1, 5, 20, 50, 100, 200, 500, 1000];
    const distances = counts.map((c) => deriveCameraDistance(c));
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// deriveTransitionSpeed
// ---------------------------------------------------------------------------

describe('deriveTransitionSpeed', () => {
  it('returns slow for large delta', () => {
    expect(deriveTransitionSpeed(8)).toBe(1.5);
  });

  it('returns medium for moderate delta', () => {
    expect(deriveTransitionSpeed(3)).toBe(1.0);
  });

  it('returns fast for small delta', () => {
    expect(deriveTransitionSpeed(1)).toBe(0.6);
  });

  it('handles negative deltas', () => {
    expect(deriveTransitionSpeed(-10)).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// deriveOrbitSpeed
// ---------------------------------------------------------------------------

describe('deriveOrbitSpeed', () => {
  it('stops rotation when locked', () => {
    expect(deriveOrbitSpeed('locked')).toBe(0);
  });

  it('reduces rotation for tight proximity', () => {
    expect(deriveOrbitSpeed('tight')).toBe(DEFAULT_ROTATION_SPEED * 0.05);
  });

  it('respects explicit override', () => {
    expect(deriveOrbitSpeed('overview', 0.42)).toBe(0.42);
  });

  it('returns default for undefined proximity', () => {
    expect(deriveOrbitSpeed(undefined)).toBe(DEFAULT_ROTATION_SPEED);
  });
});

// ---------------------------------------------------------------------------
// resolveAlignmentTopN
// ---------------------------------------------------------------------------

describe('resolveAlignmentTopN', () => {
  const nodes = [
    makeNode('close', 'drep', [80, 80, 80, 80, 80, 80]),
    makeNode('medium', 'drep', [60, 60, 60, 60, 60, 60]),
    makeNode('far', 'drep', [20, 20, 20, 20, 20, 20]),
    makeNode('spo', 'spo', [80, 80, 80, 80, 80, 80]),
  ];

  it('returns top N closest by alignment', () => {
    const result = resolveAlignmentTopN([80, 80, 80, 80, 80, 80], 2, nodes, true);
    expect(result.focusedIds.has('close')).toBe(true);
    expect(result.focusedIds.has('medium')).toBe(true);
    expect(result.focusedIds.has('far')).toBe(false);
  });

  it('filters to DReps only when drepOnly=true', () => {
    const result = resolveAlignmentTopN([80, 80, 80, 80, 80, 80], 4, nodes, true);
    expect(result.focusedIds.has('spo')).toBe(false);
    expect(result.focusedIds.size).toBe(3); // only 3 DReps
  });

  it('includes non-DReps when drepOnly=false', () => {
    const result = resolveAlignmentTopN([80, 80, 80, 80, 80, 80], 4, nodes, false);
    expect(result.focusedIds.has('spo')).toBe(true);
  });

  it('assigns higher intensity to closer nodes', () => {
    const result = resolveAlignmentTopN([80, 80, 80, 80, 80, 80], 3, nodes, true);
    const closeIntensity = result.intensities.get('close') ?? 0;
    const farIntensity = result.intensities.get('far') ?? 0;
    expect(closeIntensity).toBeGreaterThan(farIntensity);
  });

  it('creates intermediate "maybe" nodes beyond topN', () => {
    const result = resolveAlignmentTopN([80, 80, 80, 80, 80, 80], 2, nodes, true);
    // 3rd DRep should be intermediate
    expect(result.intermediateIds.has('far')).toBe(true);
    expect(result.intermediateIds.get('far')).toBeGreaterThan(0);
  });

  it('creates activation delays for sweep effect', () => {
    const result = resolveAlignmentTopN([50, 50, 50, 50, 50, 50], 3, nodes, true);
    expect(result.activationDelays.size).toBeGreaterThan(0);
    // First node (closest) should have lowest delay
    const delays = [...result.activationDelays.values()];
    expect(delays[0]).toBeLessThanOrEqual(delays[delays.length - 1]);
  });

  it('handles empty nodes array', () => {
    const result = resolveAlignmentTopN([50, 50, 50, 50, 50, 50], 5, [], true);
    expect(result.focusedIds.size).toBe(0);
    expect(result.intensities.size).toBe(0);
  });

  it('handles topN larger than available nodes', () => {
    const result = resolveAlignmentTopN([50, 50, 50, 50, 50, 50], 100, nodes, true);
    expect(result.focusedIds.size).toBe(3); // only 3 DReps exist
  });
});

// ---------------------------------------------------------------------------
// computeFocusCentroid
// ---------------------------------------------------------------------------

describe('computeFocusCentroid', () => {
  it('returns null for empty focused set', () => {
    const result = computeFocusCentroid(new Set(), [], 0);
    expect(result).toBeNull();
  });

  it('returns the node position for single focused node', () => {
    const nodes = [makeNode('a', 'drep', [50, 50, 50, 50, 50, 50], [3, 4, 5])];
    const result = computeFocusCentroid(new Set(['a']), nodes, 0);
    expect(result).not.toBeNull();
    // With 0 rotation, should be close to the node position (normalized to sphere)
    expect(result![0]).toBeCloseTo(3, 0);
  });

  it('computes average position for multiple focused nodes', () => {
    const nodes = [
      makeNode('a', 'drep', [50, 50, 50, 50, 50, 50], [2, 0, 0]),
      makeNode('b', 'drep', [50, 50, 50, 50, 50, 50], [0, 2, 0]),
    ];
    const result = computeFocusCentroid(new Set(['a', 'b']), nodes, 0);
    expect(result).not.toBeNull();
    // Centroid should be between the two nodes
    expect(result![0]).toBeCloseTo(1, 0); // avg of 2 and 0
    expect(result![1]).toBeCloseTo(1, 0); // avg of 0 and 2
  });
});

// ---------------------------------------------------------------------------
// deriveFromIntent (integration)
// ---------------------------------------------------------------------------

describe('deriveFromIntent', () => {
  const nodes = makeDreps(100);

  it('returns idle state for null intent', () => {
    const output = deriveFromIntent({ focusedIds: null }, nodes, 0, 14);
    expect(output.focus).toEqual(DEFAULT_FOCUS);
    expect(output.camera).toBeNull();
  });

  it('resolves all-dreps sentinel', () => {
    const output = deriveFromIntent(
      { focusedIds: 'all-dreps', nodeTypeFilter: 'drep', cameraProximity: 'overview' },
      nodes,
      0,
      14,
    );
    expect(output.focus.active).toBe(true);
    expect(output.focus.focusedIds.size).toBe(100); // all 100 DReps
    expect(output.focus.nodeTypeFilter).toBe('drep');
  });

  it('resolves from-alignment sentinel', () => {
    const output = deriveFromIntent(
      {
        focusedIds: 'from-alignment',
        alignmentVector: [80, 80, 80, 80, 80, 80],
        topN: 10,
        cameraProximity: 'cluster',
      },
      nodes,
      0,
      14,
    );
    expect(output.focus.active).toBe(true);
    expect(output.focus.focusedIds.size).toBe(10);
    expect(output.camera).not.toBeNull();
  });

  it('handles from-alignment without vector gracefully', () => {
    const output = deriveFromIntent({ focusedIds: 'from-alignment' }, nodes, 0, 14);
    expect(output.focus).toEqual(DEFAULT_FOCUS);
    expect(output.camera).toBeNull();
  });

  it('passes through explicit focusedIds set', () => {
    const ids = new Set(['drep-0', 'drep-1', 'drep-2']);
    const output = deriveFromIntent({ focusedIds: ids }, nodes, 0, 14);
    expect(output.focus.active).toBe(true);
    expect(output.focus.focusedIds).toBe(ids);
  });

  it('derives camera when flyToFocus is not false', () => {
    const output = deriveFromIntent(
      { focusedIds: new Set(['drep-0']), cameraProximity: 'tight', flyToFocus: true },
      nodes,
      0,
      14,
    );
    expect(output.camera).not.toBeNull();
    expect(output.camera!.distance).toBe(5); // tight proximity
  });

  it('skips camera when flyToFocus is false', () => {
    const output = deriveFromIntent(
      { focusedIds: new Set(['drep-0']), flyToFocus: false },
      nodes,
      0,
      14,
    );
    expect(output.camera).toBeNull();
  });

  it('activates focus with empty set when forceActive is true (dim-all mode)', () => {
    const output = deriveFromIntent(
      { focusedIds: new Set<string>(), forceActive: true, dimStrength: 0.8 },
      nodes,
      0,
      14,
    );
    expect(output.focus.active).toBe(true);
    expect(output.focus.focusedIds.size).toBe(0);
    expect(output.focus.scanProgress).toBe(0.8);
  });

  it('does not activate focus with empty set when forceActive is not set', () => {
    const output = deriveFromIntent({ focusedIds: new Set<string>() }, nodes, 0, 14);
    expect(output.focus.active).toBe(false);
    expect(output.focus.focusedIds.size).toBe(0);
  });

  it('uses dimStrength as scanProgress fallback', () => {
    const output = deriveFromIntent(
      { focusedIds: new Set(['drep-0']), dimStrength: 0.5 },
      nodes,
      0,
      14,
    );
    expect(output.focus.scanProgress).toBe(0.5);
  });

  it('prefers explicit scanProgress over dimStrength', () => {
    const output = deriveFromIntent(
      { focusedIds: new Set(['drep-0']), scanProgress: 0.3, dimStrength: 0.7 },
      nodes,
      0,
      14,
    );
    expect(output.focus.scanProgress).toBe(0.3);
  });

  it('passes colorOverrides through to FocusState', () => {
    const colors = new Map([['drep-0', '#ff0000']]);
    const output = deriveFromIntent(
      { focusedIds: new Set(['drep-0']), colorOverrides: colors },
      nodes,
      0,
      14,
    );
    expect(output.focus.colorOverrides).toBe(colors);
  });
});
