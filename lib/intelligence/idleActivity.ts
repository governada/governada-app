/**
 * idleActivity.ts — Types and server-side helpers for Seneca idle mode activity events.
 *
 * The activity feed shows 2-3 notable governance events on the globe homepage,
 * each wired to a globe command. No LLM needed — pure data queries.
 */

import type { GlobeCommand } from '@/lib/globe/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityEvent {
  type:
    | 'proposal_vote'
    | 'delegation_shift'
    | 'score_milestone'
    | 'ghi_change'
    | 'threshold_approach';
  headline: string;
  subLabel: string;
  entityId?: string;
  entityType?: 'drep' | 'proposal' | 'spo' | 'cc';
  globeCommand?: GlobeCommand;
  timestamp: string;
  icon: 'vote' | 'delegation' | 'milestone' | 'health' | 'threshold';
}
