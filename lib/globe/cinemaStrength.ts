import type { CinematicState } from '@/types/cinematic';

export type CinemaStrength = 'quiet' | 'soft' | 'strong' | 'tier_0';

export interface CinemaStrengthPlan {
  layer1a: number;
  layer1b: number;
  layer1bIntensifiedOnLocus?: number;
  layer2Suspended: boolean;
  nonRelevantNodesDim: number;
}

const CINEMA_STATE_STRENGTH: Record<CinematicState, CinemaStrength> = {
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

const DEMOTION_TABLE: Record<
  CinemaStrength,
  Omit<CinemaStrengthPlan, 'layer1bIntensifiedOnLocus'>
> = {
  quiet: {
    layer1a: 1,
    layer1b: 1,
    layer2Suspended: false,
    nonRelevantNodesDim: 1,
  },
  soft: {
    layer1a: 1,
    layer1b: 0.7,
    layer2Suspended: true,
    nonRelevantNodesDim: 1,
  },
  strong: {
    layer1a: 0.7,
    layer1b: 0.3,
    layer2Suspended: true,
    nonRelevantNodesDim: 0.3,
  },
  tier_0: {
    layer1a: 0.4,
    layer1b: 0,
    layer2Suspended: true,
    nonRelevantNodesDim: 0.3,
  },
};

export const CINEMA_TRANSITION_MS = 1500;
export const CINEMA_TRANSITION_EASING = 'ease-in-out' as const;

export function strengthForState(state: CinematicState): CinemaStrength {
  return CINEMA_STATE_STRENGTH[state];
}

export function applyStrength(
  strength: CinemaStrength,
  baseMotionStrength: number,
): CinemaStrengthPlan {
  const base = clamp01(baseMotionStrength);
  const plan = DEMOTION_TABLE[strength];
  return {
    layer1a: roundStrength(plan.layer1a * base),
    layer1b: roundStrength(plan.layer1b * base),
    ...(strength === 'tier_0' ? { layer1bIntensifiedOnLocus: roundStrength(1.5 * base) } : {}),
    layer2Suspended: plan.layer2Suspended,
    nonRelevantNodesDim: plan.nonRelevantNodesDim,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function roundStrength(value: number): number {
  return Math.round(value * 1000) / 1000;
}
