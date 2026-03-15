/**
 * Action Queue — aggregates urgency items from across the app into a unified prioritized list.
 *
 * Each persona gets different action types:
 * - DRep: pending votes, delegator alerts, score alerts
 * - SPO: governance votes, profile completeness
 * - Citizen (delegated): DRep activity, alignment drift, expiring proposals
 * - Citizen (undelegated): Match CTA, active proposals to browse
 *
 * Returns top 10 items sorted by priority: urgent > high > medium > low
 */

import { getOpenProposalsForDRep, getDRepById } from '@/lib/data';
import type { UserSegment } from '@/components/providers/SegmentProvider';

export type ActionPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  type:
    | 'pending_vote'
    | 'delegation_alert'
    | 'score_alert'
    | 'match_cta'
    | 'explore_governance'
    | 'profile_cta';
  priority: ActionPriority;
  title: string;
  subtitle?: string;
  href: string;
  icon: 'vote' | 'users' | 'trending' | 'compass' | 'globe' | 'user';
}

const PRIORITY_ORDER: Record<ActionPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortByPriority(items: ActionItem[]): ActionItem[] {
  return items.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/**
 * Get the unified action queue for a user.
 * Returns top 10 items sorted by priority.
 */
export async function getActionQueue(
  segment: UserSegment,
  context?: { drepId?: string | null; poolId?: string | null },
): Promise<ActionItem[]> {
  const items: ActionItem[] = [];

  if (segment === 'drep' && context?.drepId) {
    await addDRepActions(items, context.drepId);
  } else if (segment === 'spo' && context?.poolId) {
    addSPOActions(items);
  } else if (segment === 'citizen') {
    addCitizenActions(items);
  } else if (segment === 'anonymous') {
    addAnonymousActions(items);
  }

  // Always add governance exploration as a low-priority fallback
  if (items.length < 3) {
    items.push({
      id: 'explore-governance',
      type: 'explore_governance',
      priority: 'low',
      title: 'Explore active proposals',
      subtitle: 'See what governance decisions are being made',
      href: '/governance/proposals',
      icon: 'globe',
    });
  }

  return sortByPriority(items).slice(0, 10);
}

async function addDRepActions(items: ActionItem[], drepId: string): Promise<void> {
  const [drep, pendingProposals] = await Promise.all([
    getDRepById(drepId),
    getOpenProposalsForDRep(drepId),
  ]);

  // Pending votes — high priority
  if (pendingProposals.length > 0) {
    // Add the top 3 most important pending proposals individually
    const topPending = pendingProposals.slice(0, 3);
    for (const proposal of topPending) {
      items.push({
        id: `vote-${proposal.txHash}-${proposal.proposalIndex}`,
        type: 'pending_vote',
        priority: 'high',
        title: `Vote on: ${proposal.title?.slice(0, 60) ?? 'Proposal'}`,
        subtitle: `${proposal.yesCount + proposal.noCount + proposal.abstainCount} votes cast`,
        href: `/proposal/${proposal.txHash}/${proposal.proposalIndex}`,
        icon: 'vote',
      });
    }

    // Summary if more than 3
    if (pendingProposals.length > 3) {
      items.push({
        id: 'pending-votes-summary',
        type: 'pending_vote',
        priority: 'medium',
        title: `${pendingProposals.length - 3} more proposals awaiting your vote`,
        href: '/workspace',
        icon: 'vote',
      });
    }
  }

  // Score momentum alert
  if (drep?.scoreMomentum && drep.scoreMomentum < -3) {
    items.push({
      id: 'score-declining',
      type: 'score_alert',
      priority: 'medium',
      title: 'Your governance score is declining',
      subtitle: 'Vote on pending proposals to improve your participation rate',
      href: '/you/drep',
      icon: 'trending',
    });
  }
}

function addSPOActions(items: ActionItem[]): void {
  // SPO actions are simpler — primarily governance participation nudges
  items.push({
    id: 'spo-vote-check',
    type: 'explore_governance',
    priority: 'medium',
    title: 'Review active governance proposals',
    subtitle: 'SPO governance participation affects your score',
    href: '/governance/proposals',
    icon: 'globe',
  });
}

function addCitizenActions(items: ActionItem[]): void {
  // Citizens should check their delegation health and explore governance
  items.push({
    id: 'check-delegation',
    type: 'delegation_alert',
    priority: 'medium',
    title: 'Check your delegation health',
    subtitle: 'See how your DRep is representing you',
    href: '/you/delegation',
    icon: 'users',
  });
}

function addAnonymousActions(items: ActionItem[]): void {
  items.push({
    id: 'find-match',
    type: 'match_cta',
    priority: 'medium',
    title: 'Find your governance match',
    subtitle: 'Discover DReps aligned with your values',
    href: '/match',
    icon: 'compass',
  });
}
