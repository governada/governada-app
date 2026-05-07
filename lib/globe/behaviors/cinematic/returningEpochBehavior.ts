import {
  createCinematicBehavior,
  dispatchCards,
  dispatchPanel,
  focusNodes,
  makeCard,
  userNodeId,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createReturningEpochBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:returning_epoch',
    commandType: 'cinema:returning_epoch',
    run(command, ctx) {
      const user = userNodeId(command.payload);
      focusNodes([user], { proximity: 'tight', pulse: true, focusColor: '#f0e6d0' });
      ctx.schedule({ type: 'pulse', nodeId: user }, 500);
      dispatchPanel(ctx, command, 'epoch_recap', true);
      dispatchCards(ctx, command, [
        makeCard({
          id: `${command.itemId}:epoch`,
          kind: 'epoch',
          title: 'Epoch recap',
          body: 'A new governance epoch has crossed since your last visit.',
          anchorNodeId: user,
        }),
      ]);
    },
  });
}
