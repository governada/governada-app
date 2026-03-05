export type ActionType =
  | 'vote_required'
  | 'delegation_stale'
  | 'score_dropped'
  | 'proposal_expiring'
  | 'tier_approaching';

export interface Action {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  href?: string;
  priority: 1 | 2 | 3;
  cta?: string;
}

export interface ActionFeedInput {
  segment: string;
  activeProposals?: number;
  criticalProposals?: number;
  drepScore?: number;
  scoreDelta?: number;
  drepIsActive?: boolean;
  delegatedDrep?: string | null;
  delegatedDrepScore?: number;
  delegatedDrepIsActive?: boolean;
  pendingVotesCount?: number;
  drepTier?: string;
  spoScore?: number;
  spoScoreDelta?: number;
  spoVoteCount?: number;
  spoIsClaimed?: boolean;
}

const TIER_THRESHOLDS: Record<string, number> = {
  Bronze: 20,
  Silver: 40,
  Gold: 60,
  Diamond: 80,
  Legendary: 95,
};

export function generateActions(input: ActionFeedInput): Action[] {
  const {
    segment,
    activeProposals,
    criticalProposals,
    drepScore,
    scoreDelta,
    drepIsActive,
    delegatedDrep,
    delegatedDrepScore,
    delegatedDrepIsActive,
    pendingVotesCount,
  } = input;

  const actions: Action[] = [];

  if (segment === 'drep') {
    if (pendingVotesCount && pendingVotesCount > 0) {
      actions.push({
        id: 'vote_required',
        type: 'vote_required',
        title: `${pendingVotesCount} proposal${pendingVotesCount > 1 ? 's' : ''} await your vote`,
        description: 'Voting on open proposals improves your participation score.',
        href: '/proposals',
        priority: 1,
        cta: 'View Proposals',
      });
    }

    if (scoreDelta !== undefined && scoreDelta < -2) {
      actions.push({
        id: 'score_dropped',
        type: 'score_dropped',
        title: `Score dropped ${Math.abs(scoreDelta).toFixed(1)} pts`,
        description: 'Review recent participation and rationale to recover your score.',
        href: '/my-gov',
        priority: 1,
        cta: 'See Breakdown',
      });
    }

    if (drepIsActive === false) {
      actions.push({
        id: 'inactive_drep',
        type: 'delegation_stale',
        title: 'Your DRep status is inactive',
        description: 'Vote on open proposals to restore your active status.',
        href: '/proposals',
        priority: 1,
        cta: 'View Proposals',
      });
    }

    if (drepScore !== undefined) {
      const nextTier = Object.entries(TIER_THRESHOLDS).find(([, t]) => drepScore < t);
      if (nextTier) {
        const gap = nextTier[1] - drepScore;
        if (gap <= 5) {
          actions.push({
            id: 'tier_approaching',
            type: 'tier_approaching',
            title: `${gap.toFixed(1)} pts from ${nextTier[0]} tier`,
            description: 'Keep up your participation and rationale rate to reach the next tier.',
            href: '/my-gov',
            priority: 2,
            cta: 'See Breakdown',
          });
        }
      }
    }

    if (criticalProposals && criticalProposals > 0) {
      actions.push({
        id: 'critical_proposal',
        type: 'proposal_expiring',
        title: `${criticalProposals} critical proposal${criticalProposals > 1 ? 's' : ''} active`,
        description: 'High-importance proposals may expire soon.',
        href: '/proposals',
        priority: 2,
        cta: 'View Now',
      });
    }
  }

  if (segment === 'citizen' || segment === 'delegated') {
    if (!delegatedDrep) {
      actions.push({
        id: 'no_delegation',
        type: 'delegation_stale',
        title: 'You have no active delegation',
        description: 'Delegate to a DRep to participate in governance.',
        href: '/discover',
        priority: 1,
        cta: 'Find a DRep',
      });
    } else if (delegatedDrepIsActive === false) {
      actions.push({
        id: 'delegation_stale',
        type: 'delegation_stale',
        title: 'Your delegated DRep is inactive',
        description: "Your DRep hasn't voted recently. Consider re-delegating.",
        href: '/discover',
        priority: 1,
        cta: 'Find Another DRep',
      });
    } else if (delegatedDrepScore !== undefined && delegatedDrepScore < 30) {
      actions.push({
        id: 'score_dropped',
        type: 'score_dropped',
        title: "Your DRep's score is low",
        description: `Score: ${delegatedDrepScore.toFixed(0)}. Consider reviewing their performance.`,
        href: delegatedDrep ? `/drep/${delegatedDrep}` : '/discover',
        priority: 2,
        cta: 'Review DRep',
      });
    }

    if (criticalProposals && criticalProposals > 0) {
      actions.push({
        id: 'critical_proposal',
        type: 'proposal_expiring',
        title: `${criticalProposals} critical proposal${criticalProposals > 1 ? 's' : ''} in progress`,
        description: 'Important governance decisions are being made.',
        href: '/proposals',
        priority: 2,
        cta: 'View Proposals',
      });
    }

    if (activeProposals && activeProposals > 0) {
      actions.push({
        id: 'active_proposals',
        type: 'vote_required',
        title: `${activeProposals} open proposal${activeProposals > 1 ? 's' : ''} being voted on`,
        description: 'Your DRep is representing your vote on these proposals.',
        href: '/proposals',
        priority: 3,
        cta: 'See Proposals',
      });
    }
  }

  if (segment === 'spo') {
    if (pendingVotesCount && pendingVotesCount > 0) {
      actions.push({
        id: 'spo_vote_required',
        type: 'vote_required',
        title: `${pendingVotesCount} proposal${pendingVotesCount > 1 ? 's' : ''} await your pool\u2019s vote`,
        description: 'Voting on governance proposals builds your governance reputation.',
        href: '/proposals',
        priority: 1,
        cta: 'View Proposals',
      });
    }

    if (input.spoScoreDelta !== undefined && input.spoScoreDelta < -2) {
      actions.push({
        id: 'spo_score_dropped',
        type: 'score_dropped',
        title: `Pool score dropped ${Math.abs(input.spoScoreDelta).toFixed(1)} pts`,
        description: 'Review your voting participation and rationale to recover.',
        href: '/my-gov',
        priority: 1,
        cta: 'See Breakdown',
      });
    }

    if (input.spoIsClaimed === false) {
      actions.push({
        id: 'spo_claim_pool',
        type: 'delegation_stale',
        title: 'Claim your pool',
        description:
          'Verify ownership to unlock your governance dashboard and build your reputation.',
        href: '/my-gov',
        priority: 1,
        cta: 'Claim Now',
      });
    }

    if (input.spoVoteCount === 0) {
      actions.push({
        id: 'spo_first_vote',
        type: 'vote_required',
        title: 'Cast your first governance vote',
        description: 'Start building your governance score by voting on an open proposal.',
        href: '/proposals',
        priority: 2,
        cta: 'View Proposals',
      });
    }

    if (criticalProposals && criticalProposals > 0) {
      actions.push({
        id: 'spo_critical_proposal',
        type: 'proposal_expiring',
        title: `${criticalProposals} critical proposal${criticalProposals > 1 ? 's' : ''} active`,
        description: 'High-importance proposals may expire soon.',
        href: '/proposals',
        priority: 2,
        cta: 'View Now',
      });
    }
  }

  return actions.sort((a, b) => a.priority - b.priority);
}
