import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainActivityEvent } from '@/lib/chain/activityReplay';
import type { ConstellationApiData, ConstellationNode3D } from '@/lib/constellation/types';
import { DEFAULT_ROTATION_SPEED } from '@/lib/globe/types';

const mockUseGovernanceConstellation = vi.fn();
const mockUseChainActivityReplay = vi.fn();

function stripR3FHostElements(children: React.ReactNode) {
  return React.Children.toArray(children).filter(
    (child) =>
      !(
        React.isValidElement(child) &&
        typeof child.type === 'string' &&
        ['color', 'ambientLight', 'pointLight'].includes(child.type)
      ),
  );
}

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="canvas" {...props}>
      {stripR3FHostElements(children)}
    </div>
  ),
  useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  CameraControls: React.forwardRef((_props, ref) => {
    React.useImperativeHandle(ref, () => ({
      setLookAt: vi.fn(),
      dollyTo: vi.fn(),
      azimuthAngle: 0,
      polarAngle: 0,
      smoothTime: 0,
    }));
    return <div data-testid="camera-controls" />;
  }),
}));

vi.mock('@/hooks/queries', () => ({
  useGovernanceConstellation: () => mockUseGovernanceConstellation(),
}));

vi.mock('@/lib/chain/activityReplay', () => ({
  useChainActivityReplay: () => mockUseChainActivityReplay(),
}));

vi.mock('@/components/globe/GlobePostProcessing', () => ({
  GlobePostProcessing: () => null,
}));

vi.mock('@/components/globe/GlobeAmbient', () => ({
  AmbientStarfield: () => null,
}));

vi.mock('@/components/globe/GlobeEdges', () => ({
  ConstellationLines: () => null,
}));

vi.mock('@/components/globe/DelegationBond', () => ({
  DelegationBond: () => null,
}));

vi.mock('@/components/globe/MatchedEdgeGlow', () => ({
  MatchedEdgeGlow: () => null,
}));

vi.mock('@/components/globe/FlyToParticles', () => ({
  FlyToParticles: () => null,
}));

vi.mock('@/components/globe/GloryRing', () => ({
  GloryRing: () => null,
}));

vi.mock('@/components/globe/ConvergenceParticles', () => ({
  ConvergenceParticles: () => null,
}));

vi.mock('@/components/globe/ProximityHalo', () => ({
  ProximityHalo: () => null,
}));

vi.mock('@/components/globe/RegionHighlight', () => ({
  RegionHighlight: () => null,
}));

vi.mock('@/components/globe/MatchUserNode', () => ({
  MatchUserNode: () => null,
}));

vi.mock('@/components/globe/GlobeCamera', () => ({
  IdleCameraWobble: ({ motionStrength }: { motionStrength: number }) => (
    <div data-testid="idle-wobble" data-motion-strength={motionStrength} />
  ),
  CinematicCamera: () => null,
  ConstellationGroup: ({
    children,
    motionStrength,
  }: {
    children: React.ReactNode;
    motionStrength: number;
  }) => (
    <div data-testid="constellation-group" data-motion-strength={motionStrength}>
      {stripR3FHostElements(children)}
    </div>
  ),
}));

vi.mock('@/components/globe/NodePoints', () => ({
  ConstellationNodes: ({
    layer1ColorOverrides,
    layer1Brightness,
  }: {
    layer1ColorOverrides?: Map<string, string>;
    layer1Brightness?: Map<string, number>;
  }) => (
    <div
      data-testid="constellation-nodes"
      data-color-overrides={layer1ColorOverrides?.size ?? 0}
      data-brightness={layer1Brightness?.size ?? 0}
    />
  ),
}));

vi.mock('@/components/globe/Layer1Replay', () => ({
  Layer1Replay: ({
    plan,
  }: {
    plan: { voteParticles: unknown[]; rationaleFlickers: unknown[] };
  }) => (
    <div
      data-testid="layer1-replay"
      data-particles={plan.voteParticles.length}
      data-flickers={plan.rationaleFlickers.length}
    />
  ),
}));

import { GlobeConstellation } from '@/components/GlobeConstellation';

function sceneNode(
  id: string,
  fullId: string,
  nodeType: ConstellationNode3D['nodeType'],
  position: [number, number, number],
): ConstellationNode3D {
  return {
    id,
    fullId,
    name: id,
    power: 0.5,
    score: 50,
    dominant: 'transparency',
    alignments: [50, 50, 50, 50, 50, 50],
    position,
    scale: 0.1,
    nodeType,
  };
}

const drepNode = sceneNode('drep_abc123', 'drep_abc123_full', 'drep', [1, 0, 0]);
const proposalNode = sceneNode(
  'proposal-deadbeefcafe-0',
  'deadbeefcafefeed#0',
  'proposal',
  [0, 1, 0],
);

const apiData: ConstellationApiData = {
  nodes: [drepNode],
  proposalNodes: [proposalNode],
  recentEvents: [],
  stats: {
    totalAdaGoverned: '1M',
    activeProposals: 1,
    votesThisWeek: 0,
    activeDReps: 1,
    activeSpOs: 0,
    ccMembers: 0,
  },
};

describe('GlobeConstellation Layer 1 wiring', () => {
  beforeEach(() => {
    mockUseGovernanceConstellation.mockReturnValue({ data: apiData });
    mockUseChainActivityReplay.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders structural motion with no replay data and scales it by motionStrength', async () => {
    render(<GlobeConstellation motionStrength={0.05} breathing />);

    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy());
    expect(screen.getByTestId('constellation-group').dataset.motionStrength).toBe('0.05');
    expect(screen.getByTestId('idle-wobble').dataset.motionStrength).toBe('0.05');
    expect(screen.getByTestId('layer1-replay').dataset.particles).toBe('0');
    expect(screen.getByTestId('layer1-replay').dataset.flickers).toBe('0');
    expect(screen.getByTestId('canvas').parentElement?.dataset.layer1RotationSpeed).toBe(
      String(DEFAULT_ROTATION_SPEED * 0.05),
    );
  });

  it('projects replay events into particles, proposal brightness, and amber tint', async () => {
    const events: ChainActivityEvent[] = [
      {
        type: 'vote_cast',
        id: 'vote-drep-fixture',
        timestamp: 100,
        voterKind: 'drep',
        voterNodeId: drepNode.id,
        voterFullId: drepNode.fullId,
        voterIdentityColor: '#06b6d4',
        proposalNodeId: proposalNode.id,
        proposalKey: proposalNode.fullId,
        proposalTitle: 'Fixture proposal',
        vote: 'Yes',
        influenceLovelace: 1_000_000_000_000,
      },
      {
        type: 'proposal_voting_window_progress',
        id: 'proposal-progress-fixture',
        timestamp: 100,
        proposalNodeId: proposalNode.id,
        proposalKey: proposalNode.fullId,
        proposalTitle: 'Fixture proposal',
        progress: 0.5,
      },
      {
        type: 'treasury_proposal_amber',
        id: 'proposal-treasury-fixture',
        timestamp: 100,
        proposalNodeId: proposalNode.id,
        proposalKey: proposalNode.fullId,
        proposalTitle: 'Fixture proposal',
        withdrawalAmountLovelace: 1_000_000 * 1_000_000,
        amberSaturation: 0.55,
      },
    ];
    mockUseChainActivityReplay.mockReturnValue(events);

    render(<GlobeConstellation motionStrength={1} breathing />);

    await waitFor(() => expect(screen.getByTestId('canvas')).toBeTruthy());
    expect(screen.getByTestId('layer1-replay').dataset.particles).toBe('1');
    expect(screen.getByTestId('constellation-nodes').dataset.brightness).toBe('1');
    expect(screen.getByTestId('constellation-nodes').dataset.colorOverrides).toBe('1');
  });
});
