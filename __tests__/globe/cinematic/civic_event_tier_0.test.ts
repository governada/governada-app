import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCivicEventTier0Behavior } from '@/lib/globe/behaviors/cinematic/civicEventTier0Behavior';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';
import { expectCards, expectPanel, makeCinemaCommand, makeCtx } from './testUtils';

describe('civicEventTier0Behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    setSharedIntent({ focusedIds: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('wide-pans to event locus, pulses the event, opens civic briefing, and anchors one event card', () => {
    const ctx = makeCtx();
    createCivicEventTier0Behavior().execute(
      makeCinemaCommand('civic_event_tier_0', {
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
      }),
      ctx,
    );

    expect(ctx.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pulse', nodeId: 'proposal-abcdef123456-0' }),
      450,
    );
    expectPanel(ctx.dispatch, 'civic_briefing', true);
    expectCards(ctx.dispatch, 1);
    const cardsCommand = ctx.dispatch.mock.calls.find(
      ([command]) => command.type === 'anchoredCards',
    )?.[0];
    expect(cardsCommand).toEqual(
      expect.objectContaining({
        cards: [
          expect.objectContaining({
            href: '/proposal/abcdef1234567890/0',
          }),
        ],
      }),
    );
  });

  it('brightens the resolved Tier 0 affected region when the payload is hydrated', () => {
    const ctx = makeCtx();
    createCivicEventTier0Behavior().execute(
      makeCinemaCommand('civic_event_tier_0', {
        triggers: [
          {
            id: 'no-confidence:abcdef1234567890:0',
            type: 'no_confidence_ratified',
            proposalTxHash: 'abcdef1234567890',
            proposalIndex: 0,
            proposalType: 'NoConfidence',
            eventEpoch: 100,
            decayHours: 168,
          },
        ],
        tier0AffectedRegion: {
          affectedNodeIds: [
            'proposal-abcdef123456-0',
            'drep1abcdefghijk',
            'pool1abcdefghijk',
            'cc_removed_abcde',
          ],
          nonVoterDim: 0.3,
          spectatorDim: 0.5,
        },
      }),
      ctx,
    );

    const intent = getSharedIntent();
    expect(intent.focusedIds).toEqual(
      new Set([
        'proposal-abcdef123456-0',
        'drep1abcdefghijk',
        'pool1abcdefghijk',
        'cc_removed_abcde',
      ]),
    );
    expect(intent.dimStrength).toBe(0.3);
    expect(intent.focusSizeBoost).toBe(1.5);
  });
});
