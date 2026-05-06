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

import { acknowledgeItem, dismissItem } from '@/lib/governance/acknowledgments';
import {
  countMissedVotesSinceLastVisit,
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

  it('returns returning_epoch when the user crossed an epoch since last visit', async () => {
    const queue = await getCinematicState(
      user({ currentEpoch: 101, lastEpochVisited: 100 }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_epoch');
  });

  it('returns returning_cold_start for delegated users without enough signal yet', async () => {
    const queue = await getCinematicState(
      user({ delegatedDrepId: 'drep1xyz', isColdStart: true }),
      governance(),
    );

    expect(queue.primary.state).toBe('returning_cold_start');
  });

  it('returns action_required for role-scoped action items', async () => {
    const queue = await getCinematicState(
      user({ segment: 'drep' }),
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
});

describe('prioritization lifecycle writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acknowledgeItem writes an acknowledgment row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

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
    expect(upsert).toHaveBeenCalledWith(record, {
      onConflict: 'user_id_or_stake_address,item_id',
    });
  });

  it('dismissItem writes a dismissal row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({ upsert })),
    });

    const record = await dismissItem({
      userIdOrStakeAddress: 'stake1',
      itemId: 'item1',
      at: NOW,
    });

    expect(record).toMatchObject({
      user_id_or_stake_address: 'stake1',
      item_id: 'item1',
      dismissed_at: NOW,
    });
    expect(upsert).toHaveBeenCalledWith(record, {
      onConflict: 'user_id_or_stake_address,item_id',
    });
  });

  it('retires acknowledged soft items after one more visit', async () => {
    const queue = await getCinematicState(
      user({
        isColdStart: true,
        delegatedDrepId: 'drep1xyz',
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
  });

  it('does not track anonymous visitors', async () => {
    const result = await recordHomepageVisit({ stakeAddress: null, now: NOW });

    expect(result).toEqual({ tracked: false, visitStarted: false, state: null });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it('starts a new visit after the configured gap', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'visit1',
        stake_address: 'stake1',
        last_visit_at: '2026-05-06T13:00:00.000Z',
        prior_visit_at: null,
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

    const result = await recordHomepageVisit({ stakeAddress: 'stake1', now: NOW });

    expect(result.visitStarted).toBe(true);
    expect(result.state).toMatchObject({
      stake_address: 'stake1',
      last_visit_at: NOW,
      prior_visit_at: '2026-05-06T13:00:00.000Z',
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

    expect(result).toEqual({ tracked: true, visitStarted: false, state: existing });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('missed vote counting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts DRep-votable proposals without a matching vote since last visit', async () => {
    const proposalQuery = {
      select: vi.fn(() => proposalQuery),
      gte: vi.fn().mockResolvedValue({
        data: [
          { tx_hash: 'p1', proposal_index: 0, proposal_type: 'TreasuryWithdrawals' },
          { tx_hash: 'p2', proposal_index: 0, proposal_type: 'HardForkInitiation' },
          { tx_hash: 'p3', proposal_index: 0, proposal_type: 'InfoAction' },
        ],
        error: null,
      }),
    };
    const votesQuery = {
      select: vi.fn(() => votesQuery),
      eq: vi.fn(() => votesQuery),
      in: vi.fn().mockResolvedValue({
        data: [{ proposal_tx_hash: 'p1', proposal_index: 0 }],
        error: null,
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'proposals') return proposalQuery;
      if (table === 'drep_votes') return votesQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    mockGetSupabaseAdmin.mockReturnValue({ from });

    await expect(
      countMissedVotesSinceLastVisit({ claimedDrepId: 'drep1xyz', sinceEpoch: 99 }),
    ).resolves.toBe(2);
  });

  it('keeps the Phase 1 treasury threshold as the 1M ADA floor', () => {
    expect(MAJOR_TREASURY_WITHDRAWAL_ADA_FLOOR).toBe(1_000_000);
  });
});
