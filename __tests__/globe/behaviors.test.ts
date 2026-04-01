import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FocusIntent } from '@/lib/globe/types';
import type { BehaviorContext } from '@/lib/globe/behaviors/types';

// ---------------------------------------------------------------------------
// Mock setSharedIntent / getSharedIntent
// ---------------------------------------------------------------------------

const mockSetIntent = vi.fn<(intent: FocusIntent) => void>();
const mockGetIntent = vi.fn<() => FocusIntent>(() => ({ focusedIds: null }));

vi.mock('@/lib/globe/focusIntent', () => ({
  setSharedIntent: (...args: unknown[]) => mockSetIntent(args[0] as FocusIntent),
  getSharedIntent: () => mockGetIntent(),
  getSharedIntentVersion: () => 0,
}));

// Mock fetchVoteSplit for voteSplitBehavior
const mockFetchVoteSplit = vi.fn();
vi.mock('@/lib/constellation/fetchVoteSplit', () => ({
  fetchVoteSplit: (...args: unknown[]) => mockFetchVoteSplit(...args),
}));

// ---------------------------------------------------------------------------
// Import behaviors after mocks are set up
// ---------------------------------------------------------------------------

import { createTopicWarmBehavior } from '@/lib/globe/behaviors/topicWarmBehavior';
import { createClusterBehavior, setClusterCache } from '@/lib/globe/behaviors/clusterBehavior';
import { createSpatialMatchBehavior } from '@/lib/globe/behaviors/spatialMatchBehavior';
import { createDiscoveryBehavior } from '@/lib/globe/behaviors/discoveryBehavior';
import { createVoteSplitBehavior } from '@/lib/globe/behaviors/voteSplitBehavior';
import { createFocusControlBehavior } from '@/lib/globe/behaviors/focusControlBehavior';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeBehaviorCtx(): BehaviorContext {
  return {
    dispatch: vi.fn(),
    schedule: vi.fn(() => vi.fn()),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetIntent.mockReturnValue({ focusedIds: null });
});

// ---------------------------------------------------------------------------
// topicWarmBehavior
// ---------------------------------------------------------------------------

describe('topicWarmBehavior', () => {
  const behavior = createTopicWarmBehavior();

  it('handles warmTopic command type', () => {
    expect(behavior.handles).toContain('warmTopic');
  });

  it('produces from-alignment intent with treasury topic', () => {
    behavior.execute({ type: 'warmTopic', topic: 'treasury' }, makeBehaviorCtx());

    expect(mockSetIntent).toHaveBeenCalledOnce();
    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBe('from-alignment');
    expect(intent.alignmentVector).toEqual([85, 20, 50, 50, 50, 50]);
    expect(intent.topN).toBe(200);
    expect(intent.nodeTypeFilter).toBe('drep');
    expect(intent.flyToFocus).toBe(false);
    expect(intent.atmosphereWarmColor).toBe('#886644');
    expect(intent.atmosphereTemperature).toBe(0.3);
  });

  it('produces from-alignment intent with participation topic', () => {
    behavior.execute({ type: 'warmTopic', topic: 'participation' }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.alignmentVector).toEqual([50, 80, 50, 50, 50, 50]);
  });

  it('produces from-alignment intent with delegation topic', () => {
    behavior.execute({ type: 'warmTopic', topic: 'delegation' }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.alignmentVector).toEqual([50, 50, 80, 50, 50, 50]);
  });

  it('produces from-alignment intent with proposals topic', () => {
    behavior.execute({ type: 'warmTopic', topic: 'proposals' }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.alignmentVector).toEqual([50, 50, 50, 80, 50, 50]);
  });

  it('ignores non-warmTopic commands', () => {
    behavior.execute({ type: 'flyTo', nodeId: 'test' }, makeBehaviorCtx());
    expect(mockSetIntent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clusterBehavior
// ---------------------------------------------------------------------------

describe('clusterBehavior', () => {
  const behavior = createClusterBehavior();

  it('handles highlightCluster command type', () => {
    expect(behavior.handles).toContain('highlightCluster');
  });

  it('produces from-alignment intent with cluster centroid', () => {
    setClusterCache([
      { id: 'c1', memberIds: ['a', 'b', 'c'], centroid6D: [70, 30, 50, 60, 40, 55] },
    ]);

    behavior.execute({ type: 'highlightCluster', clusterId: 'c1' }, makeBehaviorCtx());

    expect(mockSetIntent).toHaveBeenCalledOnce();
    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBe('from-alignment');
    expect(intent.alignmentVector).toEqual([70, 30, 50, 60, 40, 55]);
    expect(intent.topN).toBe(150);
    expect(intent.nodeTypeFilter).toBe('drep');
    expect(intent.cameraProximity).toBe('cluster');
    expect(intent.atmosphereWarmColor).toBe('#4488cc');
    expect(intent.atmosphereTemperature).toBe(0.4);
  });

  it('does nothing for unknown cluster ID', () => {
    setClusterCache([]);
    behavior.execute({ type: 'highlightCluster', clusterId: 'unknown' }, makeBehaviorCtx());
    expect(mockSetIntent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// spatialMatchBehavior
// ---------------------------------------------------------------------------

describe('spatialMatchBehavior', () => {
  const behavior = createSpatialMatchBehavior();

  it('handles placeUserNode command type', () => {
    expect(behavior.handles).toContain('placeUserNode');
  });

  it('merges userNode into current intent', () => {
    mockGetIntent.mockReturnValue({
      focusedIds: 'all-dreps',
      nodeTypeFilter: 'drep',
    });

    behavior.execute(
      { type: 'placeUserNode', position: [1, 2, 3], intensity: 0.8 },
      makeBehaviorCtx(),
    );

    expect(mockSetIntent).toHaveBeenCalledOnce();
    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBe('all-dreps');
    expect(intent.nodeTypeFilter).toBe('drep');
    expect(intent.userNode).toEqual({ position: [1, 2, 3], intensity: 0.8 });
  });

  it('clears userNode on cleanup', () => {
    mockGetIntent.mockReturnValue({
      focusedIds: 'all-dreps',
      userNode: { position: [1, 2, 3], intensity: 0.8 },
    });

    behavior.cleanup!();

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.userNode).toBeNull();
    expect(intent.focusedIds).toBe('all-dreps');
  });
});

// ---------------------------------------------------------------------------
// discoveryBehavior
// ---------------------------------------------------------------------------

describe('discoveryBehavior', () => {
  const behavior = createDiscoveryBehavior();

  it('handles discovery command types', () => {
    expect(behavior.handles).toContain('showNeighborhood');
    expect(behavior.handles).toContain('showControversy');
    expect(behavior.handles).toContain('showActiveEntities');
  });

  it('produces intent for showNeighborhood with drep', () => {
    const ctx = makeBehaviorCtx();
    behavior.execute(
      { type: 'showNeighborhood', entityId: 'abc123', entityType: 'drep', count: 5 },
      ctx,
    );

    expect(mockSetIntent).toHaveBeenCalledOnce();
    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBeInstanceOf(Set);
    expect((intent.focusedIds as Set<string>).has('drep_abc123')).toBe(true);
    expect(intent.cameraProximity).toBe('tight');
    expect(intent.flyToFocus).toBe(true);
    expect(intent.atmosphereWarmColor).toBe('#44bbcc');
    expect(intent.atmosphereTemperature).toBe(0.3);

    // Should schedule a pulse
    expect(ctx.schedule).toHaveBeenCalledWith({ type: 'pulse', nodeId: 'drep_abc123' }, 400);
  });

  it('produces intent for showNeighborhood with proposal', () => {
    behavior.execute(
      { type: 'showNeighborhood', entityId: 'tx123', entityType: 'proposal', count: 3 },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    expect((intent.focusedIds as Set<string>).has('proposal_tx123')).toBe(true);
  });

  it('dispatches voteSplit for showControversy', () => {
    const ctx = makeBehaviorCtx();
    behavior.execute({ type: 'showControversy', proposalId: 'hash_0' }, ctx);

    expect(mockSetIntent).not.toHaveBeenCalled();
    expect(ctx.dispatch).toHaveBeenCalledWith({
      type: 'voteSplit',
      proposalRef: 'hash_0',
    });
  });

  it('produces intent for showActiveEntities', () => {
    const ctx = makeBehaviorCtx();
    behavior.execute(
      { type: 'showActiveEntities', entityType: 'drep', entityIds: ['a', 'b', 'c'] },
      ctx,
    );

    const intent = mockSetIntent.mock.calls[0][0];
    const ids = intent.focusedIds as Set<string>;
    expect(ids.size).toBe(3);
    expect(ids.has('drep_a')).toBe(true);
    expect(ids.has('drep_b')).toBe(true);
    expect(ids.has('drep_c')).toBe(true);
    expect(intent.scanProgress).toBe(0.8);
    expect(intent.flyToFocus).toBe(true);
    expect(intent.atmosphereWarmColor).toBe('#ccaa44');
    expect(intent.atmosphereTemperature).toBe(0.5);

    // Staggered pulses for first 3 nodes
    expect(ctx.schedule).toHaveBeenCalledTimes(3);
  });

  it('does nothing for empty entityIds', () => {
    behavior.execute(
      { type: 'showActiveEntities', entityType: 'drep', entityIds: [] },
      makeBehaviorCtx(),
    );
    expect(mockSetIntent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// voteSplitBehavior
// ---------------------------------------------------------------------------

describe('voteSplitBehavior', () => {
  const behavior = createVoteSplitBehavior();

  it('handles voteSplit command type', () => {
    expect(behavior.handles).toContain('voteSplit');
  });

  it('fetches vote data and produces colorOverrides intent', async () => {
    const voteMap = new Map([
      ['drep-a', 'Yes' as const],
      ['drep-b', 'No' as const],
      ['drep-c', 'Abstain' as const],
    ]);
    mockFetchVoteSplit.mockResolvedValue(voteMap);

    behavior.execute({ type: 'voteSplit', proposalRef: 'abc123_0' }, makeBehaviorCtx());

    expect(mockFetchVoteSplit).toHaveBeenCalledWith('abc123', 0);

    // Wait for async fetch to resolve
    await vi.waitFor(() => expect(mockSetIntent).toHaveBeenCalled());

    const intent = mockSetIntent.mock.calls[0][0];
    const ids = intent.focusedIds as Set<string>;
    expect(ids.size).toBe(3);
    expect(ids.has('drep-a')).toBe(true);
    expect(ids.has('drep-b')).toBe(true);
    expect(ids.has('drep-c')).toBe(true);

    const colors = intent.colorOverrides as Map<string, string>;
    expect(colors.get('drep-a')).toBe('#2dd4bf');
    expect(colors.get('drep-b')).toBe('#ef4444');
    expect(colors.get('drep-c')).toBe('#9ca3af');

    const intensities = intent.intensities as Map<string, number>;
    expect(intensities.get('drep-a')).toBe(1.0);

    expect(intent.flyToFocus).toBe(true);
    expect(intent.atmosphereWarmColor).toBe('#cc6644');
    expect(intent.atmosphereTemperature).toBe(0.4);
  });

  it('does nothing for empty vote map', async () => {
    mockFetchVoteSplit.mockResolvedValue(new Map());

    behavior.execute({ type: 'voteSplit', proposalRef: 'abc123_0' }, makeBehaviorCtx());

    await vi.waitFor(() => expect(mockFetchVoteSplit).toHaveBeenCalled());
    // Give a tick for the .then() to run
    await new Promise((r) => setTimeout(r, 10));
    expect(mockSetIntent).not.toHaveBeenCalled();
  });

  it('parses proposalRef correctly with multiple underscores', () => {
    mockFetchVoteSplit.mockResolvedValue(new Map());

    behavior.execute({ type: 'voteSplit', proposalRef: 'abc_def_123_5' }, makeBehaviorCtx());

    expect(mockFetchVoteSplit).toHaveBeenCalledWith('abc_def_123', 5);
  });

  it('does nothing for invalid proposalRef (no underscore)', () => {
    behavior.execute({ type: 'voteSplit', proposalRef: 'nounderscore' }, makeBehaviorCtx());
    expect(mockFetchVoteSplit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// focusControlBehavior
// ---------------------------------------------------------------------------

describe('focusControlBehavior', () => {
  const mockResetCamera = vi.fn();
  const mockGlobe = { resetCamera: mockResetCamera } as any;
  const behavior = createFocusControlBehavior(() => mockGlobe);

  beforeEach(() => {
    mockResetCamera.mockClear();
  });

  it('handles focus control command types', () => {
    expect(behavior.handles).toContain('highlight');
    expect(behavior.handles).toContain('dim');
    expect(behavior.handles).toContain('narrowTo');
    expect(behavior.handles).toContain('clear');
    expect(behavior.handles).toContain('reset');
  });

  it('produces from-alignment intent for highlight', () => {
    behavior.execute(
      {
        type: 'highlight',
        alignment: [80, 20, 50, 50, 50, 50],
        threshold: 150,
        topN: 30,
        nodeTypeFilter: 'drep',
        cameraAngle: 0.5,
        scanProgressOverride: 0.6,
      },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBe('from-alignment');
    expect(intent.alignmentVector).toEqual([80, 20, 50, 50, 50, 50]);
    expect(intent.topN).toBe(30);
    expect(intent.nodeTypeFilter).toBe('drep');
    expect(intent.flyToFocus).toBe(true); // noZoom not set
    expect(intent.approachAngle).toBe(0.5);
    expect(intent.scanProgress).toBe(0.6);
    expect(intent.atmosphereWarmColor).toBe('#cc8844');
    expect(intent.atmosphereTemperature).toBe(0.3);
  });

  it('produces highlight intent with noZoom', () => {
    behavior.execute(
      { type: 'highlight', alignment: [50, 50, 50, 50, 50, 50], threshold: 100, noZoom: true },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.flyToFocus).toBe(false);
  });

  it('produces highlight intent with drepOnly', () => {
    behavior.execute(
      { type: 'highlight', alignment: [50, 50, 50, 50, 50, 50], threshold: 100, drepOnly: true },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.nodeTypeFilter).toBe('drep');
  });

  it('falls back threshold to topN when topN is not provided', () => {
    behavior.execute(
      { type: 'highlight', alignment: [50, 50, 50, 50, 50, 50], threshold: 120 },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.topN).toBe(120);
  });

  it('prefers topN over threshold when both provided', () => {
    behavior.execute(
      { type: 'highlight', alignment: [50, 50, 50, 50, 50, 50], threshold: 200, topN: 30 },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.topN).toBe(30);
  });

  it('produces dim intent with forceActive and scanProgress 0', () => {
    behavior.execute({ type: 'dim' }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBeInstanceOf(Set);
    expect((intent.focusedIds as Set<string>).size).toBe(0);
    expect(intent.forceActive).toBe(true);
    expect(intent.scanProgress).toBe(0);
    expect(intent.dimStrength).toBe(0.8);
  });

  it('produces intent for narrowTo', () => {
    behavior.execute(
      { type: 'narrowTo', nodeIds: ['a', 'b', 'c'], fly: true, scanProgress: 0.5 },
      makeBehaviorCtx(),
    );

    const intent = mockSetIntent.mock.calls[0][0];
    const ids = intent.focusedIds as Set<string>;
    expect(ids.size).toBe(3);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
    expect(ids.has('c')).toBe(true);
    expect(intent.flyToFocus).toBe(true);
    expect(intent.scanProgress).toBe(0.5);
    expect(intent.cameraProximity).toBe('tight');
  });

  it('uses cluster proximity for many narrowTo nodes', () => {
    behavior.execute({ type: 'narrowTo', nodeIds: ['a', 'b', 'c', 'd', 'e'] }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.cameraProximity).toBe('cluster');
  });

  it('produces null intent for clear', () => {
    behavior.execute({ type: 'clear' }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBeNull();
  });

  it('produces null intent and resets camera for reset', () => {
    behavior.execute({ type: 'reset' }, makeBehaviorCtx());

    const intent = mockSetIntent.mock.calls[0][0];
    expect(intent.focusedIds).toBeNull();
    expect(mockResetCamera).toHaveBeenCalledOnce();
  });

  it('handles reset with null globe gracefully', () => {
    const nullBehavior = createFocusControlBehavior(() => null);
    nullBehavior.execute({ type: 'reset' }, makeBehaviorCtx());

    // Intent is still written even if globe is null
    expect(mockSetIntent).toHaveBeenCalledOnce();
    // No crash
  });
});
