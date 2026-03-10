'use client';

import type { UserSegment } from '@/components/providers/SegmentProvider';
import { PERSONA_CARDS, sortCards, type CardId } from './HubCardConfig';

// Card components
import { RepresentationCard } from './cards/RepresentationCard';
import { GovernanceHealthCard } from './cards/GovernanceHealthCard';
import { AlertCard } from './cards/AlertCard';
import { ActionCard } from './cards/ActionCard';
import { EngagementCard } from './cards/EngagementCard';
import { DiscoveryMatchCard, DiscoveryExploreCard } from './cards/DiscoveryCard';
import {
  DRepDelegatorsCard,
  DRepScoreCard,
  SPOGovernanceScoreCard,
  SPODelegatorsCard,
} from './cards/StatusCard';
import { CoverageCard } from './cards/CoverageCard';

/** Map card IDs to their React components */
const CARD_COMPONENTS: Record<CardId, React.ComponentType> = {
  representation: RepresentationCard,
  'governance-health': GovernanceHealthCard,
  coverage: CoverageCard,
  alert: AlertCard,
  engagement: EngagementCard,
  'drep-action-queue': ActionCard,
  'drep-delegators': DRepDelegatorsCard,
  'drep-score': DRepScoreCard,
  'spo-governance-score': SPOGovernanceScoreCard,
  'spo-delegators': SPODelegatorsCard,
  'discovery-match': DiscoveryMatchCard,
  'discovery-explore': DiscoveryExploreCard,
};

interface HubCardRendererProps {
  persona: UserSegment;
}

/**
 * HubCardRenderer — Takes persona, returns sorted array of Hub cards.
 *
 * Card ordering: action > status > engagement > discovery.
 * Each card is independently useful — no card depends on another being present.
 * Conditional cards (alerts, engagement) self-hide when not relevant.
 */
export function HubCardRenderer({ persona }: HubCardRendererProps) {
  const cardIds = PERSONA_CARDS[persona] ?? PERSONA_CARDS.anonymous;
  const sorted = sortCards(cardIds);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
      {sorted.map((id) => {
        const Component = CARD_COMPONENTS[id];
        if (!Component) return null;
        return <Component key={id} />;
      })}
    </div>
  );
}
