/**
 * Action Queue — aggregates urgency items from across the app into a unified prioritized list.
 *
 * Each persona gets real, data-driven action types:
 * - DRep: pending votes sorted by deadline, delegator alerts, score alerts
 * - SPO: pending governance votes with urgency, score decline
 * - Citizen (delegated): DRep inactivity, alignment drift, missed votes, critical proposals
 * - Citizen (undelegated): Match CTA, active proposals
 * - CC: fidelity monitoring
 *
 * Returns top 10 items sorted by priority: urgent > high > medium > low
 */

import { getOpenProposalsForDRep, getDRepById } from '@/lib/data';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
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
  /** Deadline label (e.g. "Expires in 2 epochs") */
  deadline?: string;
  href: string;
  icon: 'vote' | 'users' | 'trending' | 'compass' | 'globe' | 'user' | 'clock' | 'shield';
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

const currentEpoch = () => blockTimeToEpoch(Math.floor(Date.now() / 1000));

/** Proposal types that accept SPO votes */
const SPO_VOTABLE_TYPES = [
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitutionalCommittee',
  'NewConstitution',
  'UpdateConstitution',
];

/** Critical proposal types that warrant high-priority alerts */
const CRITICAL_TYPES = [
  'HardForkInitiation',
  'NoConfidence',
  'NewConstitution',
  'UpdateConstitution',
];

export interface ActionQueueContext {
  drepId?: string | null;
  poolId?: string | null;
  stakeAddress?: string | null;
  delegatedDrepId?: string | null;
}

/**
 * Get the unified action queue for a user.
 * Returns top 10 items sorted by priority.
 */
export async function getActionQueue(
  segment: UserSegment,
  context?: ActionQueueContext,
): Promise<ActionItem[]> {
  const items: ActionItem[] = [];

  if (segment === 'drep' && context?.drepId) {
    await addDRepActions(items, context.drepId);
  } else if (segment === 'spo' && context?.poolId) {
    await addSPOActions(items, context.poolId);
  } else if (segment === 'citizen') {
    await addCitizenActions(items, context);
  } else if (segment === 'cc') {
    await addCCActions(items);
  } else if (segment === 'anonymous') {
    addAnonymousActions(items);
  }

  // Low-priority fallback if queue is thin
  if (items.length < 2) {
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

// ── DRep Actions ────────────────────────────────────────────────────────

async function addDRepActions(items: ActionItem[], drepId: string): Promise<void> {
  const epoch = currentEpoch();
  const [drep, pendingProposals] = await Promise.all([
    getDRepById(drepId),
    getOpenProposalsForDRep(drepId),
  ]);

  if (pendingProposals.length > 0) {
    // Sort by deadline urgency — expiring soonest first
    const sorted = [...pendingProposals].sort((a, b) => {
      const aRemaining = a.expirationEpoch ? a.expirationEpoch - epoch : 999;
      const bRemaining = b.expirationEpoch ? b.expirationEpoch - epoch : 999;
      return aRemaining - bRemaining;
    });

    // Top 3 proposals with deadline info
    for (const proposal of sorted.slice(0, 3)) {
      const epochsRemaining = proposal.expirationEpoch ? proposal.expirationEpoch - epoch : null;
      const isUrgent = epochsRemaining !== null && epochsRemaining <= 2;

      items.push({
        id: `vote-${proposal.txHash}-${proposal.proposalIndex}`,
        type: 'pending_vote',
        priority: isUrgent ? 'urgent' : 'high',
        title: `Vote on: ${proposal.title?.slice(0, 55) ?? 'Proposal'}`,
        subtitle: `${proposal.yesCount + proposal.noCount + proposal.abstainCount} votes cast`,
        deadline:
          epochsRemaining !== null
            ? epochsRemaining <= 0
              ? 'Expiring now'
              : `Expires in ${epochsRemaining} epoch${epochsRemaining === 1 ? '' : 's'}`
            : undefined,
        href: `/proposal/${proposal.txHash}/${proposal.proposalIndex}`,
        icon: isUrgent ? 'clock' : 'vote',
      });
    }

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

// ── SPO Actions ─────────────────────────────────────────────────────────

async function addSPOActions(items: ActionItem[], poolId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const epoch = currentEpoch();

  // Get pool's existing votes to find pending proposals
  const [{ data: poolVotes }, { data: openProposals }, { data: pool }] = await Promise.all([
    supabase.from('spo_votes').select('proposal_tx_hash').eq('pool_id', poolId),
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type, expiration_epoch')
      .in('proposal_type', SPO_VOTABLE_TYPES)
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    supabase.from('pools').select('governance_score').eq('pool_id', poolId).maybeSingle(),
  ]);

  const votedTxHashes = new Set((poolVotes ?? []).map((v) => v.proposal_tx_hash));
  const pending = (openProposals ?? []).filter((p) => !votedTxHashes.has(p.tx_hash));
  const urgent = pending.filter((p) => p.expiration_epoch && p.expiration_epoch - epoch <= 2);

  if (urgent.length > 0) {
    items.push({
      id: 'spo-urgent',
      type: 'pending_vote',
      priority: 'urgent',
      title: `${urgent.length} proposal${urgent.length === 1 ? '' : 's'} expiring soon`,
      subtitle: 'Vote before the epoch deadline',
      deadline: `${urgent.length} expiring within 2 epochs`,
      href: '/governance/proposals',
      icon: 'clock',
    });
  }

  if (pending.length > urgent.length) {
    const nonUrgent = pending.length - urgent.length;
    items.push({
      id: 'spo-pending',
      type: 'pending_vote',
      priority: 'high',
      title: `${nonUrgent} governance proposal${nonUrgent === 1 ? '' : 's'} need your vote`,
      subtitle: 'SPO governance participation improves your score',
      href: '/governance/proposals',
      icon: 'vote',
    });
  }

  // Score context
  if (pool?.governance_score != null && pool.governance_score < 50) {
    items.push({
      id: 'spo-score-low',
      type: 'score_alert',
      priority: 'medium',
      title: `Gov Score: ${Math.round(pool.governance_score)} — room to improve`,
      subtitle: 'Voting and providing rationales raises your score',
      href: '/workspace',
      icon: 'trending',
    });
  }
}

// ── Citizen Actions ─────────────────────────────────────────────────────

async function addCitizenActions(items: ActionItem[], context?: ActionQueueContext): Promise<void> {
  const delegatedDrepId = context?.delegatedDrepId;

  if (!delegatedDrepId) {
    // Undelegated citizen — strong CTA to find a DRep
    items.push({
      id: 'find-drep',
      type: 'match_cta',
      priority: 'high',
      title: 'Find a DRep to represent you',
      subtitle: 'Take the governance quiz to find your match',
      href: '/match',
      icon: 'compass',
    });
    return;
  }

  const supabase = getSupabaseAdmin();

  // Query DRep data and alignment drift in parallel
  const [drep, { data: driftRecord }] = await Promise.all([
    getDRepById(delegatedDrepId),
    supabase
      .from('alignment_drift_records')
      .select('drift_score, drift_classification')
      .eq('drep_id', delegatedDrepId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!drep) return;

  // DRep inactivity check
  if (drep.lastVoteTime) {
    const daysSinceVote = Math.floor((Date.now() / 1000 - drep.lastVoteTime) / 86400);
    if (daysSinceVote > 30) {
      items.push({
        id: 'drep-inactive',
        type: 'delegation_alert',
        priority: 'high',
        title: `Your DRep has been inactive for ${daysSinceVote} days`,
        subtitle: 'Consider reviewing alternative representatives',
        href: '/match',
        icon: 'users',
      });
    }
  }

  // Alignment drift
  if (driftRecord?.drift_classification === 'high') {
    items.push({
      id: 'alignment-drift',
      type: 'delegation_alert',
      priority: 'high',
      title: 'Alignment drift detected',
      subtitle: "Your DRep's voting diverges from your values",
      href: '/you/delegation',
      icon: 'users',
    });
  }

  // Score momentum
  if (drep.scoreMomentum && drep.scoreMomentum < -3) {
    items.push({
      id: 'drep-score-drop',
      type: 'score_alert',
      priority: 'medium',
      title: "Your DRep's score is declining",
      subtitle: `Score: ${Math.round(drep.drepScore ?? 0)} — trending down`,
      href: `/drep/${encodeURIComponent(delegatedDrepId)}`,
      icon: 'trending',
    });
  }

  // Check for critical open proposals
  const { count: criticalCount } = await supabase
    .from('proposals')
    .select('tx_hash', { count: 'exact', head: true })
    .in('proposal_type', CRITICAL_TYPES)
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null);

  if (criticalCount && criticalCount > 0) {
    items.push({
      id: 'critical-proposals',
      type: 'explore_governance',
      priority: 'high',
      title: `${criticalCount} critical proposal${criticalCount === 1 ? '' : 's'} open`,
      subtitle: 'Hard Fork, No Confidence, or Constitution changes',
      href: '/governance/proposals',
      icon: 'globe',
    });
  }

  // Delegation health nudge if nothing else triggered
  if (items.length === 0) {
    items.push({
      id: 'check-delegation',
      type: 'delegation_alert',
      priority: 'low',
      title: 'Check your delegation health',
      subtitle: 'See how your DRep is representing you',
      href: '/you/delegation',
      icon: 'users',
    });
  }
}

// ── CC Actions ──────────────────────────────────────────────────────────

async function addCCActions(items: ActionItem[]): Promise<void> {
  // Check for open proposals awaiting CC votes
  const supabase = getSupabaseAdmin();
  const { count: openCount } = await supabase
    .from('proposals')
    .select('tx_hash', { count: 'exact', head: true })
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null);

  if (openCount && openCount > 0) {
    items.push({
      id: 'cc-open-proposals',
      type: 'pending_vote',
      priority: 'high',
      title: `${openCount} proposals awaiting governance votes`,
      subtitle: 'Constitutional Committee review needed',
      href: '/governance/proposals',
      icon: 'shield',
    });
  }
}

// ── Anonymous Actions ───────────────────────────────────────────────────

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
