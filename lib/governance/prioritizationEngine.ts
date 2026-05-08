import { canBodyVote } from '@/lib/governance/votingBodies';
import { blockTimeToEpoch } from '@/lib/koios';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildActionQueuePrioritizedItems } from '@/lib/actionQueue';
import type {
  CinematicState,
  GovernanceCinematicContext,
  GovernanceDelta,
  PrioritizationAcknowledgment,
  PrioritizedItem,
  PrioritizedKind,
  PrioritizedQueue,
  PrioritizedTier,
  UserCinematicContext,
  VisitState,
} from '@/types/cinematic';

const SIGNIFICANT_SCORE_MOMENTUM_DROP = -3;
const SIGNIFICANT_MISSED_VOTES = 3;

const STATE_PRIORITY: Record<CinematicState, number> = {
  civic_event_tier_0: 0,
  first_visit_anonymous: 10,
  first_visit_wallet_connected: 11,
  returning_in_session: 12,
  action_required: 20,
  returning_significant_delta: 21,
  returning_epoch: 30,
  sentiment_opportunity: 40,
  returning_cold_start: 50,
  returning_quiet: 60,
};

const STATE_KIND: Record<CinematicState, { tier: PrioritizedTier; kind: PrioritizedKind }> = {
  first_visit_anonymous: { tier: 2, kind: 'soft' },
  first_visit_wallet_connected: { tier: 2, kind: 'soft' },
  returning_in_session: { tier: 2, kind: 'informational' },
  returning_quiet: { tier: 2, kind: 'informational' },
  returning_significant_delta: { tier: 1, kind: 'informational' },
  returning_epoch: { tier: 2, kind: 'informational' },
  returning_cold_start: { tier: 2, kind: 'soft' },
  civic_event_tier_0: { tier: 0, kind: 'informational' },
  action_required: { tier: 1, kind: 'crisp' },
  sentiment_opportunity: { tier: 2, kind: 'soft' },
};

interface CandidateItem {
  item: PrioritizedItem;
  reason: string;
  priority: number;
}

interface MissedVoteProposal {
  tx_hash: string;
  proposal_index: number;
  proposal_type: string;
}

interface DRepVoteKey {
  proposal_tx_hash: string;
  proposal_index: number;
}

function nowIso(governanceContext: GovernanceCinematicContext): string {
  const now = governanceContext.now;
  if (!now) return new Date().toISOString();
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function makeItem(
  state: CinematicState,
  id: string,
  surfacedAt: string,
  payload: unknown,
): PrioritizedItem {
  return {
    id,
    ...STATE_KIND[state],
    state,
    surfaced_at: surfacedAt,
    payload,
  };
}

function makeCandidate(
  state: CinematicState,
  id: string,
  surfacedAt: string,
  payload: unknown,
  reason: string,
  priorityOffset = 0,
): CandidateItem {
  return {
    item: makeItem(state, id, surfacedAt, payload),
    reason,
    priority: STATE_PRIORITY[state] + priorityOffset,
  };
}

function acknowledgmentFor(
  acknowledgments: PrioritizationAcknowledgment[] | undefined,
  itemId: string,
): PrioritizationAcknowledgment | undefined {
  return acknowledgments?.find((ack) => ack.item_id === itemId);
}

function softItemRetired(item: PrioritizedItem, visitState?: VisitState | null): boolean {
  if (item.kind !== 'soft' || !item.acknowledged_at) return false;
  if (!visitState?.priorVisitAt || !visitState.lastVisitAt) return false;
  if (visitState.priorVisitAt === visitState.lastVisitAt) return false;
  return new Date(item.acknowledged_at).getTime() <= new Date(visitState.priorVisitAt).getTime();
}

function applyLifecycle(
  candidates: CandidateItem[],
  userContext: UserCinematicContext,
): CandidateItem[] {
  return candidates
    .map((candidate) => {
      const ack = acknowledgmentFor(userContext.acknowledgments, candidate.item.id);
      if (!ack) return candidate;
      return {
        ...candidate,
        item: {
          ...candidate.item,
          acknowledged_at: ack.acknowledged_at ?? undefined,
          dismissed_at: ack.dismissed_at ?? undefined,
        },
      };
    })
    .filter((candidate) => !softItemRetired(candidate.item, userContext.visitState));
}

function significantDeltaFromUser(userContext: UserCinematicContext): GovernanceDelta | null {
  if (
    typeof userContext.scoreMomentum === 'number' &&
    userContext.scoreMomentum < SIGNIFICANT_SCORE_MOMENTUM_DROP
  ) {
    return {
      id: 'score-momentum-drop',
      label: 'Score momentum dropped',
      scoreMomentum: userContext.scoreMomentum,
      magnitude: Math.abs(userContext.scoreMomentum),
    };
  }

  if (userContext.driftClassification === 'high') {
    return {
      id: 'alignment-drift-high',
      label: 'Alignment drift is high',
      driftClassification: userContext.driftClassification,
      magnitude: 4,
    };
  }

  if (
    typeof userContext.missedVotesCount === 'number' &&
    userContext.missedVotesCount > SIGNIFICANT_MISSED_VOTES
  ) {
    return {
      id: 'missed-votes',
      label: 'Missed votes crossed threshold',
      missedVotesCount: userContext.missedVotesCount,
      magnitude: userContext.missedVotesCount,
    };
  }

  return null;
}

function significantDeltaFromGovernance(
  deltas: GovernanceDelta[] | undefined,
): GovernanceDelta | null {
  return (
    deltas?.find(
      (delta) =>
        (typeof delta.scoreMomentum === 'number' &&
          delta.scoreMomentum < SIGNIFICANT_SCORE_MOMENTUM_DROP) ||
        delta.driftClassification === 'high' ||
        (typeof delta.missedVotesCount === 'number' &&
          delta.missedVotesCount > SIGNIFICANT_MISSED_VOTES),
    ) ?? null
  );
}

async function missedVoteDeltaFromStoredVotes(
  userContext: UserCinematicContext,
): Promise<GovernanceDelta | null> {
  if (typeof userContext.missedVotesCount === 'number') return null;
  if (!userContext.claimedDrepId) return null;

  const missedVotesCount = await countMissedVotesSincePriorVisit({
    claimedDrepId: userContext.claimedDrepId,
    sinceVisitAt: userContext.visitState?.priorVisitAt ?? null,
    sinceEpoch: userContext.lastEpochVisited ?? null,
  });

  if (missedVotesCount <= SIGNIFICANT_MISSED_VOTES) return null;

  return {
    id: 'missed-votes',
    label: 'Missed votes crossed threshold',
    missedVotesCount,
    magnitude: missedVotesCount,
  };
}

function shouldFetchActionItems(
  userContext: UserCinematicContext,
  governanceContext: GovernanceCinematicContext,
): boolean {
  if (governanceContext.actionItems) return false;
  return userContext.segment !== 'anonymous';
}

async function resolveActionItems(
  userContext: UserCinematicContext,
  governanceContext: GovernanceCinematicContext,
): Promise<PrioritizedItem[]> {
  if (governanceContext.actionItems) return governanceContext.actionItems;
  if (!shouldFetchActionItems(userContext, governanceContext)) return [];

  return buildActionQueuePrioritizedItems(userContext.segment, {
    drepId: userContext.drepId,
    poolId: userContext.poolId,
    stakeAddress: userContext.stakeAddress,
    delegatedDrepId: userContext.delegatedDrepId,
  });
}

function actionRequiredCandidate(
  actionItems: PrioritizedItem[],
  surfacedAt: string,
): CandidateItem | null {
  const relevantActions = actionItems.filter((item) => item.state === 'action_required');
  if (relevantActions.length === 0) return null;

  const urgentCount = relevantActions.filter((item) => item.tier === 1).length;
  return makeCandidate(
    'action_required',
    'action-required',
    surfacedAt,
    { items: relevantActions, count: relevantActions.length },
    `${urgentCount || relevantActions.length} role-scoped governance action(s) require attention`,
  );
}

function sentimentCandidate(
  userContext: UserCinematicContext,
  governanceContext: GovernanceCinematicContext,
  surfacedAt: string,
): CandidateItem | null {
  if (userContext.segment !== 'citizen') return null;
  const opportunities = governanceContext.sentimentOpportunities ?? [];
  if (opportunities.length === 0) return null;
  return makeCandidate(
    'sentiment_opportunity',
    'sentiment-opportunity',
    surfacedAt,
    { opportunities, count: opportunities.length },
    `${opportunities.length} citizen sentiment opportunit${
      opportunities.length === 1 ? 'y is' : 'ies are'
    } open`,
  );
}

function epochCandidate(
  userContext: UserCinematicContext,
  surfacedAt: string,
): CandidateItem | null {
  if (
    typeof userContext.currentEpoch !== 'number' ||
    typeof userContext.lastEpochVisited !== 'number'
  ) {
    return null;
  }
  if (userContext.currentEpoch <= userContext.lastEpochVisited) return null;
  return makeCandidate(
    'returning_epoch',
    `epoch-recap-${userContext.currentEpoch}`,
    surfacedAt,
    {
      currentEpoch: userContext.currentEpoch,
      lastEpochVisited: userContext.lastEpochVisited,
    },
    `User is returning after ${userContext.currentEpoch - userContext.lastEpochVisited} epoch(s)`,
  );
}

function coldStartCandidate(
  userContext: UserCinematicContext,
  surfacedAt: string,
): CandidateItem | null {
  if (!userContext.isColdStart) return null;
  return makeCandidate(
    'returning_cold_start',
    'returning-cold-start',
    surfacedAt,
    { delegatedDrepId: userContext.delegatedDrepId ?? null },
    'User has a governance context but no significant signal yet',
  );
}

function baseUserCandidate(
  userContext: UserCinematicContext,
  surfacedAt: string,
): CandidateItem | null {
  if (userContext.segment === 'anonymous') {
    return makeCandidate(
      'first_visit_anonymous',
      'first-visit-anonymous',
      surfacedAt,
      { segment: userContext.segment },
      'Anonymous visitors always resolve as first visit with no tracking',
    );
  }

  if (userContext.isFirstWalletVisit) {
    return makeCandidate(
      'first_visit_wallet_connected',
      'first-visit-wallet-connected',
      surfacedAt,
      { stakeAddress: userContext.stakeAddress ?? null },
      'Wallet-connected user has no prior visit state',
    );
  }

  if (userContext.isInSessionReturn) {
    return makeCandidate(
      'returning_in_session',
      'returning-in-session',
      surfacedAt,
      { stakeAddress: userContext.stakeAddress ?? null },
      'Return occurred inside the active visit window',
    );
  }

  return null;
}

function quietCandidate(userContext: UserCinematicContext, surfacedAt: string): CandidateItem {
  return makeCandidate(
    'returning_quiet',
    'returning-quiet',
    surfacedAt,
    {
      currentEpoch: userContext.currentEpoch ?? null,
      lastEpochVisited: userContext.lastEpochVisited ?? null,
    },
    'No Tier 0, Tier 1, or Tier 2 signal required cinema attention',
  );
}

export async function countMissedVotesSincePriorVisit(input: {
  claimedDrepId: string;
  sinceVisitAt?: string | Date | null;
  sinceEpoch?: number | null;
}): Promise<number> {
  const claimedDrepId = input.claimedDrepId.trim();
  if (!claimedDrepId) return 0;

  const sinceEpoch =
    input.sinceEpoch ??
    (input.sinceVisitAt
      ? blockTimeToEpoch(Math.floor(new Date(input.sinceVisitAt).getTime() / 1000))
      : null);

  if (sinceEpoch === null) return 0;

  const supabase = getSupabaseAdmin();
  const { data: proposals, error: proposalsError } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, proposal_type')
    .gte('proposed_epoch', sinceEpoch);

  if (proposalsError) {
    throw new Error(`Failed to read proposals for missed-vote count: ${proposalsError.message}`);
  }

  const drepVotableProposals = ((proposals ?? []) as MissedVoteProposal[]).filter((proposal) =>
    canBodyVote('drep', proposal.proposal_type),
  );
  if (drepVotableProposals.length === 0) return 0;

  const proposalTxHashes = [...new Set(drepVotableProposals.map((proposal) => proposal.tx_hash))];
  const { data: votes, error: votesError } = await supabase
    .from('drep_votes')
    .select('proposal_tx_hash, proposal_index')
    .eq('drep_id', claimedDrepId)
    .in('proposal_tx_hash', proposalTxHashes);

  if (votesError) {
    throw new Error(`Failed to read DRep votes for missed-vote count: ${votesError.message}`);
  }

  const votedKeys = new Set(
    ((votes ?? []) as DRepVoteKey[]).map(
      (vote) => `${vote.proposal_tx_hash}:${vote.proposal_index}`,
    ),
  );

  return drepVotableProposals.filter(
    (proposal) => !votedKeys.has(`${proposal.tx_hash}:${proposal.proposal_index}`),
  ).length;
}

export async function getCinematicState(
  userContext: UserCinematicContext,
  governanceContext: GovernanceCinematicContext = {},
): Promise<PrioritizedQueue> {
  const surfacedAt = nowIso(governanceContext);
  const candidates: CandidateItem[] = [];

  const tier0Triggers = governanceContext.tier0Triggers ?? [];
  if (tier0Triggers.length > 0) {
    candidates.push(
      makeCandidate(
        'civic_event_tier_0',
        tier0Triggers[0].id,
        surfacedAt,
        { triggers: tier0Triggers },
        `Tier 0 civic event supersedes personal state: ${tier0Triggers[0].type}`,
      ),
    );
  }

  const baseCandidate = baseUserCandidate(userContext, surfacedAt);
  if (baseCandidate) candidates.push(baseCandidate);

  const actionItems = await resolveActionItems(userContext, governanceContext);
  const requiredAction = actionRequiredCandidate(actionItems, surfacedAt);
  if (requiredAction) candidates.push(requiredAction);

  const significantDelta =
    significantDeltaFromUser(userContext) ??
    (await missedVoteDeltaFromStoredVotes(userContext)) ??
    significantDeltaFromGovernance(governanceContext.deltas);
  if (significantDelta) {
    candidates.push(
      makeCandidate(
        'returning_significant_delta',
        `significant-delta-${significantDelta.id}`,
        surfacedAt,
        significantDelta,
        `Significant delta detected: ${significantDelta.label ?? significantDelta.id}`,
      ),
    );
  }

  const epoch = epochCandidate(userContext, surfacedAt);
  if (epoch) candidates.push(epoch);

  const sentiment = sentimentCandidate(userContext, governanceContext, surfacedAt);
  if (sentiment) candidates.push(sentiment);

  const coldStart = coldStartCandidate(userContext, surfacedAt);
  if (coldStart) candidates.push(coldStart);

  candidates.push(quietCandidate(userContext, surfacedAt));

  const lifecycleCandidates = applyLifecycle(candidates, userContext).sort(
    (a, b) => a.priority - b.priority,
  );
  const primaryCandidate =
    lifecycleCandidates.find(
      (candidate) => candidate.item.kind !== 'soft' || !candidate.item.dismissed_at,
    ) ?? lifecycleCandidates[0];

  const secondary = [
    ...lifecycleCandidates
      .filter((candidate) => candidate.item.id !== primaryCandidate.item.id)
      .map((candidate) => candidate.item),
    ...actionItems.filter((item) => item.id !== primaryCandidate.item.id),
  ];

  return {
    primary: primaryCandidate.item,
    secondary,
    meta: {
      reasoning: primaryCandidate.reason,
      generatedAt: surfacedAt,
    },
  };
}
