import {
  actionCards,
  createCinematicBehavior,
  dispatchCards,
  dispatchPanel,
  firstProposalNodeId,
  focusNodes,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createActionRequiredBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:action_required',
    commandType: 'cinema:action_required',
    run(command, ctx) {
      const cards = actionCards(command.payload);
      const proposalNodes = cards.length
        ? cards.map((card) => card.anchorNodeId)
        : [firstProposalNodeId(command.payload)];
      focusNodes(proposalNodes, {
        proximity: proposalNodes.length > 1 ? 'cluster' : 'tight',
        pulse: true,
        focusColor: '#f97316',
        dimStrength: command.strengthPlan.nonRelevantNodesDim,
      });
      proposalNodes.slice(0, 2).forEach((nodeId, index) => {
        ctx.schedule({ type: 'pulse', nodeId }, 350 + index * 160);
      });
      dispatchPanel(ctx, command, 'action_queue', true);
      dispatchCards(ctx, command, cards);
    },
  });
}
