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
import type { CinematicState, PrioritizedItem, PrioritizedQueue } from '@/types/cinematic';

export interface CinematicDispatchContext {
  dispatch: (command: GlobeCommand) => void;
  item?: PrioritizedItem;
  meta?: PrioritizedQueue['meta'];
  baseMotionStrength?: number;
}

export function dispatchCinematicState(
  state: CinematicState,
  payload: unknown,
  ctx: CinematicDispatchContext,
): CinemaStrengthPlan {
  const strength = strengthForState(state);
  const plan = applyStrength(strength, ctx.baseMotionStrength ?? 1);
  const reasoning = ctx.meta?.reasoning ?? 'cinematic state dispatched';
  const itemId = ctx.item?.id ?? state;

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
  ctx: Pick<CinematicDispatchContext, 'dispatch' | 'baseMotionStrength'>,
): CinemaStrengthPlan {
  const plan = applyStrength('quiet', ctx.baseMotionStrength ?? 1);
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
