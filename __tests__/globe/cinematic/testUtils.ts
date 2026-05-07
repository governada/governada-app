import { vi, expect } from 'vitest';
import { applyStrength, strengthForState } from '@/lib/globe/cinemaStrength';
import type { BehaviorContext } from '@/lib/globe/behaviors/types';
import type { CinematicArrivalCommand, GlobeCommand } from '@/lib/globe/types';
import type { CinematicState } from '@/types/cinematic';

export function makeCtx(): BehaviorContext & {
  dispatch: ReturnType<typeof vi.fn<(command: GlobeCommand) => void>>;
  schedule: ReturnType<typeof vi.fn<(command: GlobeCommand, delayMs: number) => () => void>>;
} {
  return {
    dispatch: vi.fn<(command: GlobeCommand) => void>(),
    schedule: vi.fn<(command: GlobeCommand, delayMs: number) => () => void>(() => vi.fn()),
  };
}

export function makeCinemaCommand(
  state: CinematicState,
  payload: unknown = {},
): CinematicArrivalCommand {
  const strength = strengthForState(state);
  return {
    type: `cinema:${state}`,
    cinematicState: state,
    itemId: `${state}:fixture`,
    payload,
    reasoning: `${state} fixture reasoning`,
    strength,
    strengthPlan: applyStrength(strength, 1),
  };
}

export function expectPanel(
  dispatch: ReturnType<typeof vi.fn<(command: GlobeCommand) => void>>,
  presentation: Extract<GlobeCommand, { type: 'senecaPanel' }>['presentation'],
  open: boolean,
) {
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'senecaPanel', presentation, open }),
  );
}

export function expectCards(
  dispatch: ReturnType<typeof vi.fn<(command: GlobeCommand) => void>>,
  count: number,
) {
  const call = dispatch.mock.calls.find(([command]) => command.type === 'anchoredCards');
  expect(call).toBeTruthy();
  const command = call?.[0] as Extract<GlobeCommand, { type: 'anchoredCards' }>;
  expect(command.cards).toHaveLength(count);
}
