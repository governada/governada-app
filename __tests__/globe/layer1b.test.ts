import { describe, expect, it } from 'vitest';
import type { ChainActivityEvent } from '@/lib/chain/activityReplay';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import {
  buildLayer1RenderPlan,
  computeTreasuryAmberSaturation,
  getTreasuryAmberColor,
  RATIONALE_FLICKER_DURATION_MS,
  RATIONALE_FLICKER_EMISSIVE_BUMP,
  scaleInfluenceToParticleSize,
  TREASURY_AMBER_MAX_ADA,
  TREASURY_AMBER_MIN_ADA,
  VOTE_PARTICLE_FADE_MS,
  VOTE_PARTICLE_MAX_SCALE,
  VOTE_PARTICLE_MIN_SCALE,
} from '@/lib/globe/layer1Constants';

function node(id: string, fullId: string, position: [number, number, number]): ConstellationNode3D {
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
    nodeType: id.startsWith('proposal-') ? 'proposal' : 'drep',
  };
}

const nodes = [
  node('drep_abc123', 'drep_abc123_full', [1, 0, 0]),
  node('proposal-deadbeefcafe-0', 'deadbeefcafefeed#0', [0, 1, 0]),
];

describe('Layer 1b replay renderer plan', () => {
  it('emits no particles, flickers, or synthetic proposal cues for an empty stream', () => {
    const plan = buildLayer1RenderPlan({
      events: [],
      nodes,
      motionStrength: 1,
    });

    expect(plan.voteParticles).toHaveLength(0);
    expect(plan.rationaleFlickers).toHaveLength(0);
    expect(plan.proposalBrightness.size).toBe(0);
    expect(plan.proposalColorOverrides.size).toBe(0);
  });

  it('keeps Tim Q2.1 and Q2.3 visual values as named constants', () => {
    expect(VOTE_PARTICLE_FADE_MS).toBe(500);
    expect(VOTE_PARTICLE_MIN_SCALE).toBe(1);
    expect(VOTE_PARTICLE_MAX_SCALE).toBe(2);
    expect(RATIONALE_FLICKER_EMISSIVE_BUMP).toBe(0.2);
    expect(RATIONALE_FLICKER_DURATION_MS).toBe(300);
  });

  it('plans identity-color, log-scaled vote particles on a gentle arc', () => {
    const events: ChainActivityEvent[] = [
      {
        type: 'vote_cast',
        id: 'vote-drep-fixture',
        timestamp: 100,
        voterKind: 'drep',
        voterNodeId: 'drep_abc123',
        voterFullId: 'drep_abc123_full',
        voterIdentityColor: '#06b6d4',
        proposalNodeId: 'proposal-deadbeefcafe-0',
        proposalKey: 'deadbeefcafefeed#0',
        proposalTitle: 'Fixture proposal',
        vote: 'Yes',
        influenceLovelace: 1_000_000_000_000,
      },
    ];

    const plan = buildLayer1RenderPlan({ events, nodes, motionStrength: 1 });

    expect(plan.voteParticles).toHaveLength(1);
    expect(plan.voteParticles[0].color).toBe('#06b6d4');
    expect(plan.voteParticles[0].sizeMultiplier).toBeGreaterThan(1);
    expect(plan.voteParticles[0].sizeMultiplier).toBeLessThanOrEqual(2);
    expect(plan.voteParticles[0].control).not.toEqual([0.5, 0.5, 0]);
  });

  it('fully gates Layer 1b when motion strength is zero', () => {
    const events: ChainActivityEvent[] = [
      {
        type: 'vote_cast',
        id: 'vote-drep-fixture',
        timestamp: 100,
        voterKind: 'drep',
        voterNodeId: 'drep_abc123',
        voterFullId: 'drep_abc123_full',
        voterIdentityColor: '#06b6d4',
        proposalNodeId: 'proposal-deadbeefcafe-0',
        proposalKey: 'deadbeefcafefeed#0',
        proposalTitle: 'Fixture proposal',
        vote: 'Yes',
        influenceLovelace: 1_000_000_000_000,
      },
    ];

    const plan = buildLayer1RenderPlan({ events, nodes, motionStrength: 0 });

    expect(plan.voteParticles).toHaveLength(0);
    expect(plan.rationaleFlickers).toHaveLength(0);
  });

  it('clamps influence sizing to the Q2.1 1.0-2.0x range', () => {
    expect(scaleInfluenceToParticleSize(null)).toBe(1);
    expect(scaleInfluenceToParticleSize(1_000_000)).toBe(1);
    expect(scaleInfluenceToParticleSize(1_000_000_000_000_000)).toBe(2);
  });

  it('uses logarithmic treasury amber saturation from 10k ADA to 100M ADA', () => {
    expect(TREASURY_AMBER_MIN_ADA).toBe(10_000);
    expect(TREASURY_AMBER_MAX_ADA).toBe(100_000_000);
    expect(computeTreasuryAmberSaturation(100_000 * 1_000_000)).toBeCloseTo(0.325, 3);
    expect(computeTreasuryAmberSaturation(1_000_000 * 1_000_000)).toBeCloseTo(0.55, 3);
    expect(computeTreasuryAmberSaturation(10_000_000 * 1_000_000)).toBeCloseTo(0.775, 3);
    expect(getTreasuryAmberColor(1_000_000 * 1_000_000)).toBe('hsl(36, 50%, 55%)');
  });
});
