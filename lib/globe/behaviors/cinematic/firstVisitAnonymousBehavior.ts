import { createCinematicBehavior, dispatchCards, dispatchPanel, establishCamera } from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createFirstVisitAnonymousBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:first_visit_anonymous',
    commandType: 'cinema:first_visit_anonymous',
    run(command, ctx) {
      establishCamera(ctx, 19);
      dispatchPanel(ctx, command, 'first_visit_briefing', true);
      dispatchCards(ctx, command, []);
    },
  });
}
