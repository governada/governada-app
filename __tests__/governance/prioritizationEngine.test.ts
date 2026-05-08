import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GovernanceCinematicContext,
  PrioritizedItem,
  UserCinematicContext,
} from '@/types/cinematic';

const mockGetSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock('@/lib/data', () => ({
  getOpenProposalsForDRep: vi.fn(),
  getDRepById: vi.fn(),
}));

vi.mock('@/lib/koios', () => ({
  blockTimeToEpoch: vi.fn(() => 100),
}));

import {
  acknowledgeItem,
  dismissItem,
  type ItemLifecycleRecord,
} from '@/lib/governance/acknowledgments';
import {
  countMissedVotesSincePriorVisit,
  getCinematicState,
} from '@/lib/governance/prioritizationEngine';
import { MAJOR_TREASURY_WITHDRAWAL_ADA_FLOOR } from '@/lib/governance/tier0Triggers';
import { recordHomepageVisit, VISIT_GAP_MINUTES } from '@/lib/governance/visitState';

const NOW = '2026-05-06T14:00:00.000Z';

function user(overrides: Partial<UserCinematicContext> = {}): UserCinematicContext {
  return {
    segment: 'citizen',
    hasConnectedWallet: true,
    currentEpoch: 100,
    lastEpochVisited: 100,
    ...overrides,
  };
}

function governance(
  overrides: Partial<GovernanceCinematicContext> = {},
): GovernanceCinematicContext {
  return {
    now: NOW,
    actionItems: [],
    tier0Triggers: [],
    sentimentOpportunities: [],
    ...overrides,
  };
}

function actionItem(overrides: Partial<PrioritizedItem> = {}): PrioritizedItem {
  return {
    id: 'vote-required',
    tier: 1,
    kind: 'crisp',
    state: 'action_required',
    surfaced_at: NOW,
    payload: { title: 'Vote required' },
    ...overrides,
  };
}

describe('prioritization engine selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReset();
  });

  it('returns first_visit_anonymous for anonymous visitors', async () => {
    const queue = await getCinematicState(user({ segment: 'anonymous' }), governance());

    expect(queue.primary.state).toBe('first_visit_anonymous');
    expect(queue.meta.reasoning).toContain('Anonymous visitors');
  });

  it('returns first_visit_wallet_connected for a first connected-wallet visit', async () => {
    const queue = await getCinematicState(user({ isFirstWalletVisit: true }), governance());

    expect(queue.primary.state).toBe('first_visit_wallet_connected');
  });

  it('returns returning_in_session for a tab return inside the visit window', async () => {
    const queue = await getCinematicState(user({ isInSessionReturn: true }), governance());

    expect(queue.primary.state).toBe('returning_in_session');
  });

  it('returns returning_quiet when no signal is present', async () => {
    const queue = await getCinematicState(user(), governance());

    expect(queue.primary.state).toBe('returning_quiet');
  });

  it('returns returning_significant_delta for a score-momentum drop', async () => {
    const queue = await getCinematicState(user({ scoreMomentum: -4 }), governance());

    expect(queue.primary.state).toBe('returning_significant_delta');
  });

  it('returns returning_significant_delta for missed votes above the threshold', async () => {
    const queue = await getCinematicState(user({ missedVotesCount: 4 }), governance());

    expect(queue.primary.state).toBe('returning_significant_delta');
  });

  it('returns returning_significant_delta when a claimed DRep missed closed votes since last visit', async () => {
    const { votesQuery } = mockMissedVoteSource({
      proposals: Array.from({ length: 4 }, (_, index) =>
        proposal(`closed-${index}`, { ratified_epoch: 100 }),
      ),
      votes: [],
    });

    const queue = await getCinematicState(
      user({ claimedDrepId: 'drep1claimed', lastEpochVisited: 99 }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_significant_delta');
    expect(votesQuery.eq).toHaveBeenCalledWith('drep_id', 'drep1claimed');
  });

  it('returns returning_significant_delta when a delegated citizen has missed closed votes', async () => {
    const { votesQuery } = mockMissedVoteSource({
      proposals: Array.from({ length: 4 }, (_, index) =>
        proposal(`delegated-closed-${index}`, { expired_epoch: 100 }),
      ),
      votes: [],
    });

    const queue = await getCinematicState(
      user({ delegatedDrepId: 'drep1delegated', lastEpochVisited: 99 }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_significant_delta');
    expect(votesQuery.eq).toHaveBeenCalledWith('drep_id', 'drep1delegated');
  });

  it('returns returning_epoch when the user crossed an epoch since last visit', async () => {
    const queue = await getCinematicState(
      user({ currentEpoch: 101, lastEpochVisited: 100 }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_epoch');
  });

  it('returns returning_cold_start for delegated users without enough signal yet', async () => {
    mockMissedVoteSource({ proposals: [], votes: [] });
    const queue = await getCinematicState(
      user({ delegatedDrepId: 'drep1xyz', isColdStart: true }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_cold_start');
  });

  it('keeps delegated returning users quiet when they are not cold-start', async () => {
    mockMissedVoteSource({ proposals: [], votes: [] });
    const queue = await getCinematicState(user({ delegatedDrepId: 'drep1xyz' }), governance());

    expect(queue.primary.state).toBe('returning_quiet');
  });

  it('routes delegated users with competing action signals away from cold-start', async () => {
    const queue = await getCinematicState(
      user({ delegatedDrepId: 'drep1xyz', isColdStart: false, missedVotesCount: 0 }),
      governance({ actionItems: [actionItem()] }),
    );

    expect(queue.primary.state).toBe('action_required');
  });

  it('returns action_required for role-scoped action items', async () => {
    const queue = await getCinematicState(
      user({ segment: 'drep' }),
      governance({ actionItems: [actionItem()] }),
    );

    expect(queue.primary.state).toBe('action_required');
  });

  it('routes SPO personas with pending scope to action_required', async () => {
    const queue = await getCinematicState(
      user({ segment: 'spo', poolId: 'pool1xyz' }),
      governance({ actionItems: [actionItem()] }),
    );

    expect(queue.primary.state).toBe('action_required');
  });

  it('routes CC personas with pending scope to action_required', async () => {
    const queue = await getCinematicState(
      user({ segment: 'cc', ccHotId: 'cc1xyz' }),
      governance({ actionItems: [actionItem()] }),
    );

    expect(queue.primary.state).toBe('action_required');
  });

  it('returns sentiment_opportunity for citizen sentiment opportunities', async () => {
    const queue = await getCinematicState(
      user(),
      governance({
        sentimentOpportunities: [
          {
            id: 'proposal-1',
            title: 'Treasury sentiment',
            proposalType: 'TreasuryWithdrawals',
          },
        ],
      }),
    );

    expect(queue.primary.state).toBe('sentiment_opportunity');
  });

  it('does not return sentiment_opportunity for non-citizen personas', async () => {
    const queue = await getCinematicState(
      user({ segment: 'drep', drepId: 'drep1xyz' }),
      governance({
        sentimentOpportunities: [
          {
            id: 'proposal-1',
            title: 'Treasury sentiment',
            proposalType: 'TreasuryWithdrawals',
          },
        ],
      }),
    );

    expect(queue.primary.state).toBe('returning_quiet');
  });

  it('returns civic_event_tier_0 when Tier 0 triggers exist', async () => {
    const queue = await getCinematicState(
      user({ scoreMomentum: -9, missedVotesCount: 7 }),
      governance({
        tier0Triggers: [
          {
            id: 'hard-fork:abc:0',
            type: 'hard_fork_enacted',
            proposalTxHash: 'abc',
            proposalIndex: 0,
            proposalType: 'HardForkInitiation',
            eventEpoch: 100,
            decayHours: 168,
          },
        ],
        actionItems: [actionItem()],
      }),
    );

    expect(queue.primary.state).toBe('civic_event_tier_0');
    expect(queue.primary.tier).toBe(0);
    expect(queue.meta.reasoning).toContain('supersedes personal state');
  });

  it('does not allow dismissals to bypass informational Tier 0 triggers', async () => {
    const trigger = {
      id: 'hard-fork:abc:0',
      type: 'hard_fork_enacted' as const,
      proposalTxHash: 'abc',
      proposalIndex: 0,
      proposalType: 'HardForkInitiation',
      eventEpoch: 100,
      decayHours: 168,
    };
    const queue = await getCinematicState(
      user({
        acknowledgments: [
          {
            item_id: trigger.id,
            acknowledged_at: null,
            dismissed_at: NOW,
          },
        ],
      }),
      governance({
        tier0Triggers: [trigger],
        actionItems: [actionItem()],
      }),
    );

    expect(queue.primary.state).toBe('civic_event_tier_0');
  });
});

describe('prioritization lifecycle writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReset();
  });

  it('acknowledgeItem writes an acknowledgment row', async () => {
    const { rpc } = mockLifecycleMergeRpc();
    mockGetSupabaseAdmin.mockReturnValue({ rpc });

    const record = await acknowledgeItem({
      userIdOrStakeAddress: 'stake1',
      itemId: 'item1',
      at: NOW,
    });

    expect(record).toMatchObject({
      user_id_or_stake_address: 'stake1',
      item_id: 'item1',
      acknowledged_at: NOW,
      dismissed_at: null,
    });
    expect(rpc).toHaveBeenCalledWith('ack_dismiss_merge', {
      p_user_id_or_stake_address: 'stake1',
      p_item_id: 'item1',
      p_ack_at: NOW,
      p_dismiss_at: null,
    });
  });

  it('acknowledgeItem preserves an existing dismissal timestamp', async () => {
    const existing = {
      user_id_or_stake_address: 'stake1',
      item_id: 'item1',
      acknowledged_at: null,
      dismissed_at: '2026-05-06T13:30:00.000Z',
    };
    const { rpc } = mockLifecycleMergeRpc([existing]);
    mockGetSupabaseAdmin.mockReturnValue({ rpc });

    const record = await acknowledgeItem({
      userIdOrStakeAddress: 'stake1',
      itemId: 'item1',
      at: NOW,
    });

    expect(record).toMatchObject({
      acknowledged_at: NOW,
      dismissed_at: existing.dismissed_at,
    });
  });

  it('dismissItem writes a dismissal row', async () => {
    const { rpc } = mockLifecycleMergeRpc();
    mockGetSupabaseAdmin.mockReturnValue({ rpc });

    const record = await dismissItem({
      userIdOrStakeAddress: 'stake1',
      itemId: 'item1',
      at: NOW,
    });

    expect(record).toMatchObject({
      user_id_or_stake_address: 'stake1',
      item_id: 'item1',
      acknowledged_at: null,
      dismissed_at: NOW,
    });
    expect(rpc).toHaveBeenCalledWith('ack_dismiss_merge', {
      p_user_id_or_stake_address: 'stake1',
      p_item_id: 'item1',
      p_ack_at: null,
      p_dismiss_at: NOW,
    });
  });

  it('dismissItem preserves an existing acknowledgment timestamp', async () => {
    const existing = {
      user_id_or_stake_address: 'stake1',
      item_id: 'item1',
      acknowledged_at: '2026-05-06T13:30:00.000Z',
      dismissed_at: null,
    };
    const { rpc } = mockLifecycleMergeRpc([existing]);
    mockGetSupabaseAdmin.mockReturnValue({ rpc });

    const record = await dismissItem({
      userIdOrStakeAddress: 'stake1',
      itemId: 'item1',
      at: NOW,
    });

    expect(record).toMatchObject({
      acknowledged_at: existing.acknowledged_at,
      dismissed_at: NOW,
    });
  });

  it('preserves concurrent acknowledge and dismiss timestamps through the merge RPC', async () => {
    const { rpc, records } = mockLifecycleMergeRpc();
    mockGetSupabaseAdmin.mockReturnValue({ rpc });
    const ackAt = '2026-05-06T13:45:00.000Z';
    const dismissAt = '2026-05-06T13:46:00.000Z';

    await Promise.all([
      acknowledgeItem({ userIdOrStakeAddress: 'stake1', itemId: 'item1', at: ackAt }),
      dismissItem({ userIdOrStakeAddress: 'stake1', itemId: 'item1', at: dismissAt }),
    ]);

    expect(records.get('stake1:item1')).toMatchObject({
      acknowledged_at: ackAt,
      dismissed_at: dismissAt,
    });
  });

  it('retires acknowledged soft items after one more visit', async () => {
    const queue = await getCinematicState(
      user({
        isColdStart: true,
        delegatedDrepId: 'drep1xyz',
        missedVotesCount: 0,
        acknowledgments: [
          {
            item_id: 'returning-cold-start',
            acknowledged_at: '2026-05-06T13:00:00.000Z',
            dismissed_at: null,
          },
        ],
        visitState: {
          priorVisitAt: '2026-05-06T13:30:00.000Z',
          lastVisitAt: NOW,
        },
      }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_quiet');
  });
});

describe('homepage visit tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReset();
  });

  it('does not track anonymous visitors', async () => {
    const result = await recordHomepageVisit({ stakeAddress: null, now: NOW });

    expect(result).toEqual({
      tracked: false,
      visitStarted: false,
      state: null,
      priorEpochVisited: null,
    });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('starts a new visit after the configured gap', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'visit1',
        stake_address: 'stake1',
        last_visit_at: '2026-05-06T13:00:00.000Z',
        prior_visit_at: null,
        last_epoch_visited: 99,
      },
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle,
      upsert,
    };

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await recordHomepageVisit({
      stakeAddress: 'stake1',
      now: NOW,
      currentEpoch: 100,
    });

    expect(result.visitStarted).toBe(true);
    expect(result.priorEpochVisited).toBe(99);
    expect(result.state).toMatchObject({
      stake_address: 'stake1',
      last_visit_at: NOW,
      prior_visit_at: '2026-05-06T13:00:00.000Z',
      last_epoch_visited: 100,
    });
    expect(upsert).toHaveBeenCalledWith(result.state, { onConflict: 'stake_address' });
  });

  it('keeps views within the gap in the same visit', async () => {
    const lastVisitAt = new Date(
      new Date(NOW).getTime() - (VISIT_GAP_MINUTES - 1) * 60 * 1000,
    ).toISOString();
    const existing = {
      id: 'visit1',
      stake_address: 'stake1',
      last_visit_at: lastVisitAt,
      prior_visit_at: null,
      last_epoch_visited: 100,
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle,
      upsert,
    };

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => query),
    });

    const result = await recordHomepageVisit({ stakeAddress: 'stake1', now: NOW });

    expect(result).toEqual({
      tracked: true,
      visitStarted: false,
      state: existing,
      priorEpochVisited: 100,
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('surfaces prior epoch visited so returning_epoch is reachable through visit state', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'visit1',
        stake_address: 'stake1',
        last_visit_at: '2026-05-06T13:00:00.000Z',
        prior_visit_at: null,
        last_epoch_visited: 99,
      },
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle,
      upsert,
    };

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => query),
    });

    const visit = await recordHomepageVisit({
      stakeAddress: 'stake1',
      now: NOW,
      currentEpoch: 100,
    });
    const queue = await getCinematicState(
      user({
        currentEpoch: 100,
        lastEpochVisited: visit.priorEpochVisited,
        visitState: {
          lastVisitAt: visit.state?.last_visit_at ?? null,
          priorVisitAt: visit.state?.prior_visit_at ?? null,
          priorEpochVisited: visit.priorEpochVisited,
        },
      }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_epoch');
  });
});

describe('missed vote counting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReset();
  });

  it('counts DRep-votable proposals without a matching vote since last visit', async () => {
    const { proposalQuery } = mockMissedVoteSource({
      proposals: [
        proposal('p1', { ratified_epoch: 100 }),
        proposal('p2', { dropped_epoch: 100, proposal_type: 'HardForkInitiation' }),
        proposal('p3', { expired_epoch: 100, proposal_type: 'InfoAction' }),
      ],
      votes: [{ proposal_tx_hash: 'p1', proposal_index: 0 }],
    });

    await expect(
      countMissedVotesSincePriorVisit({ drepId: 'drep1xyz', sinceEpoch: 99 }),
    ).resolves.toBe(2);
    expect(proposalQuery.or).toHaveBeenCalledWith(
      'ratified_epoch.not.is.null,dropped_epoch.not.is.null,expired_epoch.not.is.null,enacted_epoch.not.is.null',
    );
  });

  it('returns zero when only open unvoted proposals remain after the closed-proposal filter', async () => {
    const { proposalQuery, votesQuery } = mockMissedVoteSource({
      proposals: [],
      votes: [],
    });

    await expect(
      countMissedVotesSincePriorVisit({ drepId: 'drep1xyz', sinceEpoch: 99 }),
    ).resolves.toBe(0);
    expect(proposalQuery.or).toHaveBeenCalledWith(
      'ratified_epoch.not.is.null,dropped_epoch.not.is.null,expired_epoch.not.is.null,enacted_epoch.not.is.null',
    );
    expect(votesQuery.select).not.toHaveBeenCalled();
  });

  it('keeps the Phase 1 treasury threshold as the 1M ADA floor', () => {
    expect(MAJOR_TREASURY_WITHDRAWAL_ADA_FLOOR).toBe(1_000_000);
  });
});

function proposal(
  txHash: string,
  overrides: Partial<{
    proposal_index: number;
    proposal_type: string;
    ratified_epoch: number | null;
    dropped_epoch: number | null;
    expired_epoch: number | null;
    enacted_epoch: number | null;
  }> = {},
) {
  return {
    tx_hash: txHash,
    proposal_index: overrides.proposal_index ?? 0,
    proposal_type: overrides.proposal_type ?? 'TreasuryWithdrawals',
    ratified_epoch: overrides.ratified_epoch ?? null,
    dropped_epoch: overrides.dropped_epoch ?? null,
    expired_epoch: overrides.expired_epoch ?? null,
    enacted_epoch: overrides.enacted_epoch ?? null,
  };
}

function mockMissedVoteSource({
  proposals,
  votes,
}: {
  proposals: ReturnType<typeof proposal>[];
  votes: Array<{ proposal_tx_hash: string; proposal_index: number }>;
}) {
  const proposalQuery = {
    select: vi.fn(() => proposalQuery),
    gte: vi.fn(() => proposalQuery),
    or: vi.fn().mockResolvedValue({ data: proposals, error: null }),
  };
  const votesQuery = {
    select: vi.fn(() => votesQuery),
    eq: vi.fn(() => votesQuery),
    in: vi.fn().mockResolvedValue({ data: votes, error: null }),
  };
  const from = vi.fn((table: string) => {
    if (table === 'proposals') return proposalQuery;
    if (table === 'drep_votes') return votesQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  mockGetSupabaseAdmin.mockReturnValue({ from });
  return { proposalQuery, votesQuery, from };
}

interface AckDismissMergeArgs {
  p_user_id_or_stake_address: string;
  p_item_id: string;
  p_ack_at: string | null;
  p_dismiss_at: string | null;
}

function lifecycleKey(userIdOrStakeAddress: string, itemId: string): string {
  return `${userIdOrStakeAddress}:${itemId}`;
}

function mockLifecycleMergeRpc(initial: ItemLifecycleRecord[] = []) {
  const records = new Map(
    initial.map((record) => [
      lifecycleKey(record.user_id_or_stake_address, record.item_id),
      { ...record },
    ]),
  );

  const rpc = vi.fn(async (_functionName: string, args: AckDismissMergeArgs) => {
    await Promise.resolve();
    const key = lifecycleKey(args.p_user_id_or_stake_address, args.p_item_id);
    const existing = records.get(key);
    const record: ItemLifecycleRecord = {
      user_id_or_stake_address: args.p_user_id_or_stake_address,
      item_id: args.p_item_id,
      acknowledged_at: args.p_ack_at ?? existing?.acknowledged_at ?? null,
      dismissed_at: args.p_dismiss_at ?? existing?.dismissed_at ?? null,
    };
    records.set(key, record);
    return { data: [record], error: null };
  });

  return { rpc, records };
}
