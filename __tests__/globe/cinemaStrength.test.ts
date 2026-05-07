import { describe, expect, it } from 'vitest';
import { applyStrength, strengthForState } from '@/lib/globe/cinemaStrength';
import type { CinematicState } from '@/types/cinematic';

describe('cinema strength tiers', () => {
  it('maps matrix states to strength tiers', () => {
    const expected: Record<CinematicState, ReturnType<typeof strengthForState>> = {
      first_visit_anonymous: 'soft',
      first_visit_wallet_connected: 'soft',
      returning_in_session: 'quiet',
      returning_quiet: 'quiet',
      returning_significant_delta: 'strong',
      returning_epoch: 'soft',
      returning_cold_start: 'soft',
      civic_event_tier_0: 'tier_0',
      action_required: 'strong',
      sentiment_opportunity: 'soft',
    };

    for (const [state, strength] of Object.entries(expected) as Array<
      [CinematicState, ReturnType<typeof strengthForState>]
    >) {
      expect(strengthForState(state)).toBe(strength);
    }
  });

  it('applies quiet, soft, strong, and Tier 0 demotion percentages', () => {
    expect(applyStrength('quiet', 1)).toEqual({
      layer1a: 1,
      layer1b: 1,
      layer2Suspended: false,
      nonRelevantNodesDim: 1,
    });
    expect(applyStrength('soft', 1)).toEqual({
      layer1a: 1,
      layer1b: 0.7,
      layer2Suspended: true,
      nonRelevantNodesDim: 1,
    });
    expect(applyStrength('strong', 1)).toEqual({
      layer1a: 0.7,
      layer1b: 0.3,
      layer2Suspended: true,
      nonRelevantNodesDim: 0.3,
    });
    expect(applyStrength('tier_0', 1)).toEqual({
      layer1a: 0.4,
      layer1b: 0,
      layer1bIntensifiedOnLocus: 1.5,
      layer2Suspended: true,
      nonRelevantNodesDim: 0.3,
    });
  });

  it('multiplies Tim Q6.3 percentages by base motion strength', () => {
    expect(applyStrength('strong', 0.5)).toEqual({
      layer1a: 0.35,
      layer1b: 0.15,
      layer2Suspended: true,
      nonRelevantNodesDim: 0.3,
    });
    expect(applyStrength('tier_0', 0.5)).toMatchObject({
      layer1a: 0.2,
      layer1b: 0,
      layer1bIntensifiedOnLocus: 0.75,
    });
  });
});
