import {
  createCinematicBehavior,
  dispatchCards,
  dispatchPanel,
  focusNodes,
  makeCard,
  tier0AffectedRegionFromPayload,
  tier0LocusNodeIds,
} from './shared';
import type { ConstellationRef } from '@/lib/globe/types';

export function createCivicEventTier0Behavior(_getGlobe?: () => ConstellationRef | null) {
  return createCinematicBehavior({
    id: 'cinema:civic_event_tier_0',
    commandType: 'cinema:civic_event_tier_0',
    run(command, ctx) {
      const locus = tier0LocusNodeIds(command.payload);
      const affectedRegion = tier0AffectedRegionFromPayload(command.payload);
      const affectedNodeIds = affectedRegion?.affectedNodeIds.length
        ? affectedRegion.affectedNodeIds
        : locus;

      focusNodes(affectedNodeIds, {
        proximity: 'overview',
        pulse: true,
        focusColor: '#fbbf24',
        dimStrength: affectedRegion?.nonVoterDim ?? command.strengthPlan.nonRelevantNodesDim,
        focusSizeBoost: command.strengthPlan.layer1bIntensifiedOnLocus ?? 1.18,
        intensity: command.strengthPlan.layer1bIntensifiedOnLocus ?? 1,
      });
      ctx.schedule({ type: 'pulse', nodeId: locus[0] }, 450);
      dispatchPanel(ctx, command, 'civic_briefing', true);
      dispatchCards(ctx, command, [
        makeCard({
          id: `${command.itemId}:civic`,
          kind: 'civic',
          title: 'Civic event',
          body: 'The polity has spoken. Personal items are waiting in Seneca.',
          anchorNodeId: locus[0],
        }),
      ]);
    },
  });
}
