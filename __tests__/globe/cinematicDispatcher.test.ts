import { describe, expect, it, vi } from 'vitest';
import {
  dispatchCinematicExit,
  dispatchCinematicState,
  resolveCinematicPayload,
} from '@/lib/globe/cinematicDispatcher';
import type { GlobeCommand } from '@/lib/globe/types';

describe('cinematicDispatcher', () => {
  it('applies cinema strength on entry and routes to the state behavior command', () => {
    const dispatch = vi.fn<(command: GlobeCommand) => void>();
    const plan = dispatchCinematicState(
      'action_required',
      { items: [] },
      {
        dispatch,
        item: {
          id: 'action-required',
          tier: 1,
          kind: 'crisp',
          state: 'action_required',
          surfaced_at: '2026-05-06T00:00:00.000Z',
          payload: {},
        },
        meta: {
          reasoning: 'role-scoped action',
          generatedAt: '2026-05-06T00:00:00.000Z',
        },
      },
    );

    expect(plan.layer1a).toBe(0.7);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'cinemaStrength',
        phase: 'enter',
        transitionMs: 1500,
        easing: 'ease-in-out',
      }),
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'cinema:action_required',
        reasoning: 'role-scoped action',
      }),
    );
  });

  it('fades layers back to quiet over 1.5 seconds on cinema exit', () => {
    const dispatch = vi.fn<(command: GlobeCommand) => void>();
    const plan = dispatchCinematicExit('civic_event_tier_0', { dispatch });

    expect(plan).toMatchObject({ layer1a: 1, layer1b: 1, layer2Suspended: false });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cinemaStrength',
        phase: 'exit',
        strength: 'quiet',
        transitionMs: 1500,
        easing: 'ease-in-out',
      }),
    );
  });

  it('hydrates Tier 0 payloads with the affected region before dispatch', async () => {
    const payload = {
      triggers: [
        {
          id: 'hard-fork:abcdef1234567890:0',
          type: 'hard_fork_enacted',
          proposalTxHash: 'abcdef1234567890',
          proposalIndex: 0,
          proposalType: 'HardForkInitiation',
          eventEpoch: 100,
          decayHours: 168,
        },
      ],
    };
    const resolved = await resolveCinematicPayload('civic_event_tier_0', payload, {
      resolveTier0Region: vi.fn(async () => ({
        affectedNodeIds: new Set(['proposal-abcdef123456-0', 'drep1abcdefghijk']),
        nonVoterDim: 0.3,
        spectatorDim: 0.5,
      })),
    });

    expect(resolved).toMatchObject({
      tier0AffectedRegion: {
        affectedNodeIds: ['proposal-abcdef123456-0', 'drep1abcdefghijk'],
        nonVoterDim: 0.3,
        spectatorDim: 0.5,
      },
    });
  });
});
