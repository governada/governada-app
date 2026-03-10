/**
 * Hub Card Configuration
 *
 * Defines which cards each persona sees, their data dependencies,
 * render priority, and ordering rules.
 *
 * Card priority: action > status > engagement > discovery
 * Every card is independently useful and links somewhere.
 */

import type { UserSegment } from '@/components/providers/SegmentProvider';

export type CardType = 'action' | 'status' | 'engagement' | 'discovery';

export type CardId =
  | 'representation'
  | 'governance-health'
  | 'coverage'
  | 'alert'
  | 'engagement'
  | 'drep-action-queue'
  | 'drep-delegators'
  | 'drep-score'
  | 'spo-governance-score'
  | 'spo-delegators'
  | 'discovery-match'
  | 'discovery-explore';

export interface HubCardDefinition {
  id: CardId;
  type: CardType;
  /** Priority within its type (lower = higher priority) */
  priority: number;
  /** When false, card is always shown. When a function, card is conditionally shown. */
  conditional: boolean;
  /** Link target for the card */
  href: string;
}

/** Card definitions — the registry of all possible Hub cards */
export const CARD_DEFINITIONS: Record<CardId, HubCardDefinition> = {
  // Citizen cards
  representation: {
    id: 'representation',
    type: 'status',
    priority: 1,
    conditional: false,
    href: '/delegation',
  },
  'governance-health': {
    id: 'governance-health',
    type: 'status',
    priority: 2,
    conditional: false,
    href: '/pulse',
  },
  coverage: {
    id: 'coverage',
    type: 'status',
    priority: 3,
    conditional: false,
    href: '/delegation',
  },
  alert: {
    id: 'alert',
    type: 'action',
    priority: 1,
    conditional: true,
    href: '/delegation',
  },
  engagement: {
    id: 'engagement',
    type: 'engagement',
    priority: 1,
    conditional: true,
    href: '/engage',
  },

  // DRep cards
  'drep-action-queue': {
    id: 'drep-action-queue',
    type: 'action',
    priority: 1,
    conditional: false,
    href: '/workspace',
  },
  'drep-delegators': {
    id: 'drep-delegators',
    type: 'status',
    priority: 1,
    conditional: false,
    href: '/workspace/delegators',
  },
  'drep-score': {
    id: 'drep-score',
    type: 'status',
    priority: 2,
    conditional: false,
    href: '/workspace/performance',
  },

  // SPO cards
  'spo-governance-score': {
    id: 'spo-governance-score',
    type: 'status',
    priority: 1,
    conditional: false,
    href: '/workspace',
  },
  'spo-delegators': {
    id: 'spo-delegators',
    type: 'status',
    priority: 2,
    conditional: true,
    href: '/workspace/delegators',
  },

  // Discovery cards
  'discovery-match': {
    id: 'discovery-match',
    type: 'discovery',
    priority: 1,
    conditional: false,
    href: '/match',
  },
  'discovery-explore': {
    id: 'discovery-explore',
    type: 'discovery',
    priority: 2,
    conditional: false,
    href: '/discover',
  },
};

/** Which cards each persona sees, in render order (action > status > engagement > discovery) */
export const PERSONA_CARDS: Record<UserSegment, CardId[]> = {
  anonymous: ['discovery-match', 'discovery-explore'],
  citizen: ['alert', 'representation', 'coverage', 'governance-health', 'engagement'],
  drep: [
    'drep-action-queue',
    'drep-delegators',
    'drep-score',
    'coverage',
    'representation',
    'governance-health',
  ],
  spo: [
    'spo-governance-score',
    'spo-delegators',
    'coverage',
    'representation',
    'governance-health',
  ],
  cc: ['representation', 'coverage', 'governance-health', 'engagement'],
};

/** Sort cards by type priority, then by card priority within type */
const TYPE_ORDER: Record<CardType, number> = {
  action: 0,
  status: 1,
  engagement: 2,
  discovery: 3,
};

export function sortCards(cardIds: CardId[]): CardId[] {
  return [...cardIds].sort((a, b) => {
    const defA = CARD_DEFINITIONS[a];
    const defB = CARD_DEFINITIONS[b];
    const typeComp = TYPE_ORDER[defA.type] - TYPE_ORDER[defB.type];
    if (typeComp !== 0) return typeComp;
    return defA.priority - defB.priority;
  });
}
