import {
  changedNodeId,
  createCinematicBehavior,
  dispatchCards,
  dispatchPanel,
  focusNodes,
  makeCard,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createReturningSignificantDeltaBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:returning_significant_delta',
    commandType: 'cinema:returning_significant_delta',
    run(command, ctx) {
      const changed = changedNodeId(command.payload);
      focusNodes([changed], {
        proximity: 'tight',
        pulse: true,
        focusColor: '#f59e0b',
        dimStrength: command.strengthPlan.nonRelevantNodesDim,
      });
      ctx.schedule({ type: 'pulse', nodeId: changed }, 350);
      dispatchPanel(ctx, command, 'delta_briefing', true);
      dispatchCards(ctx, command, [
        makeCard({
          id: `${command.itemId}:delta`,
          kind: 'delta',
          title: 'Meaningful change',
          body: 'Seneca has the context queued.',
          anchorNodeId: changed,
        }),
      ]);
    },
  });
}
