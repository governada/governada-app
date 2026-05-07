import { ambientCluster, createCinematicBehavior, dispatchCards, dispatchPanel } from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createReturningQuietBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:returning_quiet',
    commandType: 'cinema:returning_quiet',
    run(command, ctx) {
      ambientCluster();
      dispatchPanel(ctx, command, 'closed', false);
      dispatchCards(ctx, command, []);
    },
  });
}
