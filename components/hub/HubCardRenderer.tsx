'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useReducedMotion, LayoutGroup } from 'framer-motion';
import type { UserSegment } from '@/components/providers/SegmentProvider';
import { PERSONA_CARDS, sortCards, type CardId } from './HubCardConfig';
import { useHubInsights } from '@/hooks/useHubInsights';
import { HubInsightLine } from './HubInsightLine';

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
import { BriefingCard } from './cards/BriefingCard';
import { TreasuryPulseCard } from './cards/TreasuryPulseCard';
import { CommunityConsensus } from './CommunityConsensus';

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
  briefing: BriefingCard,
  'treasury-pulse': TreasuryPulseCard,
  'discovery-match': DiscoveryMatchCard,
  'discovery-explore': DiscoveryExploreCard,
};

interface HubCardRendererProps {
  persona: UserSegment;
}

/**
 * HubCardRenderer — Takes persona, returns sorted array of Hub cards.
 *
 * Card ordering: action > status > engagement > discovery (default).
 * When ai_composed_hub flag is enabled, ordering adapts to temporal
 * governance mode (urgent/active/calm) with spring-animated reordering.
 *
 * Each card gains an AI-generated one-line insight with Perplexity-style
 * source citations when available.
 */
export function HubCardRenderer({ persona }: HubCardRendererProps) {
  const cardIds = PERSONA_CARDS[persona] ?? PERSONA_CARDS.anonymous;
  const { insightMap, getCardOrder, isEnabled } = useHubInsights();
  const prefersReducedMotion = useReducedMotion();

  // Use temporal-mode ordering when AI hub is enabled, otherwise default sort
  const sorted = isEnabled ? getCardOrder(sortCards(cardIds)) : sortCards(cardIds);

  // Track previous order for animation — only animate after first render
  const prevOrderRef = useRef<string[]>(sorted);
  const [hasReordered, setHasReordered] = useState(false);

  useEffect(() => {
    const prev = prevOrderRef.current;
    if (prev.join(',') !== sorted.join(',')) {
      setHasReordered(true);
    }
    prevOrderRef.current = sorted;
  }, [sorted]);

  // Animated layout when cards reorder (spring transition, 300ms)
  const shouldAnimate = isEnabled && hasReordered && !prefersReducedMotion;

  return (
    <LayoutGroup id="hub-cards">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
        {sorted.map((id) => {
          const Component = CARD_COMPONENTS[id as CardId];
          if (!Component) return null;
          const insight = insightMap.get(id);

          if (shouldAnimate) {
            return (
              <motion.div
                key={id}
                layout
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 30,
                  duration: 0.3,
                }}
              >
                <Component />
                {isEnabled && <HubInsightLine insight={insight} />}
              </motion.div>
            );
          }

          return (
            <div key={id}>
              <Component />
              {isEnabled && <HubInsightLine insight={insight} />}
            </div>
          );
        })}
        <CommunityConsensus />
      </div>
    </LayoutGroup>
  );
}
