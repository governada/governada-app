import {
  createCinematicBehavior,
  dispatchCards,
  dispatchPanel,
  focusNodes,
  makeCard,
  userNodeId,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createFirstVisitWalletConnectedBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:first_visit_wallet_connected',
    commandType: 'cinema:first_visit_wallet_connected',
    run(command, ctx) {
      const user = userNodeId(command.payload);
      focusNodes([user], { proximity: 'tight', pulse: true, focusColor: '#f0e6d0' });
      ctx.schedule({ type: 'pulse', nodeId: user }, 450);
      dispatchPanel(ctx, command, 'team_briefing', true);
      dispatchCards(ctx, command, [
        makeCard({
          id: `${command.itemId}:team`,
          kind: 'team',
          title: 'Your governance team',
          body: 'Your wallet now has a place in the constellation.',
          anchorNodeId: user,
        }),
      ]);
    },
  });
}
