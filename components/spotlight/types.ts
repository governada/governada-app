/**
 * Spotlight Theater — shared types for the entity discovery experience.
 */

import type { EnrichedDRep } from '@/lib/koios';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';

// ─── Entity Union ─────────────────────────────────────────────────────────────

export type SpotlightEntityType = 'drep' | 'spo' | 'proposal';

export interface SpotlightDRep {
  entityType: 'drep';
  id: string;
  data: EnrichedDRep;
}

export interface SpotlightSPO {
  entityType: 'spo';
  id: string;
  data: GovernadaSPOData;
}

export interface SpotlightProposal {
  entityType: 'proposal';
  id: string; // txHash-index
  data: BrowseProposal;
}

export type SpotlightEntity = SpotlightDRep | SpotlightSPO | SpotlightProposal;

// ─── View Mode ────────────────────────────────────────────────────────────────

export type SpotlightViewMode = 'spotlight' | 'cards' | 'table';

// ─── Spotlight Action ─────────────────────────────────────────────────────────

export type SpotlightAction = 'track' | 'skip' | 'details';

// ─── Queue Sorting ────────────────────────────────────────────────────────────

export type QueueSort = 'score' | 'match' | 'recency';
