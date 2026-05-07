import {
  createCinematicBehavior,
  delegatedDrepNodeId,
  dispatchCards,
  dispatchPanel,
  focusNodes,
  userNodeId,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createReturningColdStartBehavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:returning_cold_start',
    commandType: 'cinema:returning_cold_start',
    run(command, ctx) {
      const delegated = delegatedDrepNodeId(command.payload);
      const nodes = delegated ? [userNodeId(command.payload), delegated] : [];
      if (nodes.length) {
        focusNodes(nodes, { proximity: 'cluster', pulse: true, focusColor: '#f0e6d0' });
        ctx.schedule({ type: 'pulse', nodeId: delegated ?? nodes[0] }, 450);
      }
      dispatchPanel(ctx, command, 'cold_start', true);
      dispatchCards(ctx, command, []);
    },
  });
}
