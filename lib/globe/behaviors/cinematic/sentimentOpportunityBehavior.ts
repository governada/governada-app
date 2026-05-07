import {
  createCinematicBehavior,
  dispatchCards,
  dispatchPanel,
  firstProposalNodeId,
  focusNodes,
  makeCard,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createSentimentOpportunityBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:sentiment_opportunity',
    commandType: 'cinema:sentiment_opportunity',
    run(command, ctx) {
      const proposalNode = firstProposalNodeId(command.payload);
      focusNodes([proposalNode], { proximity: 'tight', pulse: true, focusColor: '#2dd4bf' });
      ctx.schedule({ type: 'pulse', nodeId: proposalNode }, 450);
      dispatchPanel(ctx, command, 'sentiment_prompt', true);
      dispatchCards(ctx, command, [
        makeCard({
          id: `${command.itemId}:sentiment`,
          kind: 'sentiment',
          title: 'Weigh in',
          body: 'Your signal can help representatives read the room.',
          anchorNodeId: proposalNode,
        }),
      ]);
    },
  });
}
