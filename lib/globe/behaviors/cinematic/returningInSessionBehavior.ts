import { createCinematicBehavior, dispatchCards, dispatchPanel } from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createReturningInSessionBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:returning_in_session',
    commandType: 'cinema:returning_in_session',
    run(command, ctx) {
      dispatchPanel(ctx, command, 'closed', false);
      dispatchCards(ctx, command, []);
    },
  });
}
