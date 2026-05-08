import {
  applyStrength,
  CINEMA_TRANSITION_EASING,
  CINEMA_TRANSITION_MS,
  strengthForState,
} from '@/lib/globe/cinemaStrength';
import type { CinemaStrengthPlan } from '@/lib/globe/cinemaStrength';
import type { GlobeCommand } from '@/lib/globe/types';
import {
  readTier0TriggersFromPayload,
  resolveTier0AffectedRegion,
  serializeTier0AffectedRegion,
} from '@/lib/governance/tier0AffectedRegion';
import { posthog } from '@/lib/posthog';
import type { CinematicState, PrioritizedItem, PrioritizedQueue } from '@/types/cinematic';

export type CinemaInterruptionReason = 'user_input' | 'tier_0_supersede' | 'error';

const activeCinemaEntries = new Map<CinematicState, number>();

export interface CinematicDispatchContext {
  dispatch: (command: GlobeCommand) => void;
  item?: PrioritizedItem;
  meta?: PrioritizedQueue['meta'];
  baseMotionStrength?: number;
  interruptedByUser?: boolean;
}

export function dispatchCinematicState(
  state: CinematicState,
  payload: unknown,
  ctx: CinematicDispatchContext,
): CinemaStrengthPlan {
  const strength = strengthForState(state);
  const plan = applyStrength(strength, ctx.baseMotionStrength ?? 1);
  const reasoning = (ctx.meta?.reasoning ?? 'cinematic state dispatched').slice(0, 300);
  const itemId = ctx.item?.id ?? state;
  activeCinemaEntries.set(state, Date.now());

  // PostHog payload: { state, tier, reasoning, interruptedByUser }.
  posthog.capture('cinema_arrival_state', {
    state,
    tier: normalizeTier(ctx.item?.tier),
    reasoning,
    interruptedByUser: ctx.interruptedByUser === true,
  });

  ctx.dispatch({
    type: 'cinemaStrength',
    phase: 'enter',
    state,
    strength,
    plan,
    transitionMs: CINEMA_TRANSITION_MS,
    easing: CINEMA_TRANSITION_EASING,
    reasoning,
  });

  ctx.dispatch({
    type: `cinema:${state}`,
    cinematicState: state,
    itemId,
    payload,
    reasoning,
    strength,
    strengthPlan: plan,
  });

  return plan;
}

export function dispatchCinematicExit(
  state: CinematicState,
  ctx: Pick<CinematicDispatchContext, 'dispatch' | 'baseMotionStrength'> & {
    interruptionReason?: CinemaInterruptionReason;
  },
): CinemaStrengthPlan {
  const plan = applyStrength('quiet', ctx.baseMotionStrength ?? 1);
  const startedAt = activeCinemaEntries.get(state);
  activeCinemaEntries.delete(state);

  if (ctx.interruptionReason) {
    // PostHog payload: { state, reasonCode }.
    posthog.capture('cinema_state_interrupted', {
      state,
      reasonCode: ctx.interruptionReason,
    });
  } else if (startedAt !== undefined) {
    // PostHog payload: { state, durationMs }.
    posthog.capture('cinema_state_completed', {
      state,
      durationMs: Math.max(0, Date.now() - startedAt),
    });
  }

  ctx.dispatch({
    type: 'cinemaStrength',
    phase: 'exit',
    state,
    strength: 'quiet',
    plan,
    transitionMs: CINEMA_TRANSITION_MS,
    easing: CINEMA_TRANSITION_EASING,
    reasoning: 'cinema exit restores steady state',
  });
  return plan;
}

function normalizeTier(tier: PrioritizedItem['tier'] | undefined): 0 | 1 | 2 {
  return tier === 0 || tier === 1 || tier === 2 ? tier : 2;
}

export async function resolveCinematicPayload(
  state: CinematicState,
  payload: unknown,
  options: {
    resolveTier0Region?: typeof resolveTier0AffectedRegion;
  } = {},
): Promise<unknown> {
  if (state !== 'civic_event_tier_0') return payload;

  const [trigger] = readTier0TriggersFromPayload(payload);
  if (!trigger) return payload;

  try {
    const region = await (options.resolveTier0Region ?? resolveTier0AffectedRegion)(trigger);
    const base = payload && typeof payload === 'object' ? payload : {};
    return {
      ...base,
      tier0AffectedRegion: serializeTier0AffectedRegion(region),
    };
  } catch {
    return payload;
  }
}
