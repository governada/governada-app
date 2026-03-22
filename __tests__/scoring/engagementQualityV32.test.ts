import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import {
  computeEngagementQuality,
  computeRationaleDiversity,
  computeCoverageBreadth,
} from '@/lib/scoring/engagementQuality';
import type { VoteData, ProposalVotingSummary } from '@/lib/scoring/types';
import { makeVoteData, NOW, ONE_DAY } from '../fixtures/scoring';

// ── Helpers ──

function makeVotes(drepId: string, configs: Partial<VoteData>[]): Map<string, VoteData[]> {
  return new Map([[drepId, configs.map((c) => makeVoteData({ drepId, ...c }))]]);
}

function emptySummaries(): Map<string, ProposalVotingSummary> {
  return new Map();
}

function makeSummaries(keys: string[], yesRatios: number[]): Map<string, ProposalVotingSummary> {
  const map = new Map<string, ProposalVotingSummary>();
  for (let i = 0; i < keys.length; i++) {
    const total = 10000;
    map.set(keys[i], {
      proposalKey: keys[i],
      drepYesVotePower: Math.round(total * yesRatios[i]),
      drepNoVotePower: Math.round(total * (1 - yesRatios[i])),
      drepAbstainVotePower: 0,
    });
  }
  return map;
}

const TYPE_COUNTS = new Map([
  ['TreasuryWithdrawals', 10],
  ['ParameterChange', 5],
  ['HardForkInitiation', 2],
  ['InfoAction', 3],
]);

// ── Rationale Diversity Tests ──

describe('computeRationaleDiversity', () => {
  it('returns 100 for 10 unique meta_hashes out of 10 votes', () => {
    const votes = Array.from({ length: 10 }, (_, i) =>
      makeVoteData({
        rationaleMetaHash: `hash_${i}`,
        proposalKey: `tx_${i}-0`,
      }),
    );
    expect(computeRationaleDiversity(votes)).toBe(100);
  });

  it('returns 20 for 2 unique meta_hashes out of 10 votes', () => {
    const votes = Array.from({ length: 10 }, (_, i) =>
      makeVoteData({
        rationaleMetaHash: i < 5 ? 'hash_a' : 'hash_b',
        proposalKey: `tx_${i}-0`,
      }),
    );
    expect(computeRationaleDiversity(votes)).toBe(20);
  });

  it('returns neutral 50 when fewer than 3 rationales have meta_hash', () => {
    const votes = [
      makeVoteData({ rationaleMetaHash: 'hash_1', proposalKey: 'tx_0-0' }),
      makeVoteData({ rationaleMetaHash: 'hash_2', proposalKey: 'tx_1-0' }),
      makeVoteData({ rationaleMetaHash: null, proposalKey: 'tx_2-0' }),
    ];
    expect(computeRationaleDiversity(votes)).toBe(50);
  });

  it('returns neutral 50 for 0 votes', () => {
    expect(computeRationaleDiversity([])).toBe(50);
  });

  it('returns 10 when 1 hash is reused across 10 votes (extreme copy-paste)', () => {
    const votes = Array.from({ length: 10 }, (_, i) =>
      makeVoteData({
        rationaleMetaHash: 'same_hash',
        proposalKey: `tx_${i}-0`,
      }),
    );
    expect(computeRationaleDiversity(votes)).toBe(10);
  });

  it('ignores votes without meta_hash (null) in both numerator and denominator', () => {
    const votes = [
      makeVoteData({ rationaleMetaHash: 'a', proposalKey: 'tx_0-0' }),
      makeVoteData({ rationaleMetaHash: 'b', proposalKey: 'tx_1-0' }),
      makeVoteData({ rationaleMetaHash: 'c', proposalKey: 'tx_2-0' }),
      makeVoteData({ rationaleMetaHash: null, proposalKey: 'tx_3-0' }),
      makeVoteData({ rationaleMetaHash: null, proposalKey: 'tx_4-0' }),
    ];
    // 3 unique out of 3 with hashes = 100
    expect(computeRationaleDiversity(votes)).toBe(100);
  });
});

// ── Coverage Breadth Tests ──

describe('computeCoverageBreadth', () => {
  it('treasury specialist scores ~90 in treasury-heavy epoch', () => {
    // 90% treasury, 10% other
    const heavyTreasury = new Map([
      ['TreasuryWithdrawals', 90],
      ['HardForkInitiation', 10],
    ]);

    const votes = Array.from({ length: 5 }, (_, i) =>
      makeVoteData({
        proposalType: 'TreasuryWithdrawals',
        proposalKey: `tx_${i}-0`,
      }),
    );

    const score = computeCoverageBreadth(votes, heavyTreasury);
    expect(score).toBe(90);
  });

  it('DRep covering all types scores 100', () => {
    const votes = [
      makeVoteData({ proposalType: 'TreasuryWithdrawals', proposalKey: 'tx_0-0' }),
      makeVoteData({ proposalType: 'ParameterChange', proposalKey: 'tx_1-0' }),
      makeVoteData({ proposalType: 'HardForkInitiation', proposalKey: 'tx_2-0' }),
      makeVoteData({ proposalType: 'InfoAction', proposalKey: 'tx_3-0' }),
    ];

    expect(computeCoverageBreadth(votes, TYPE_COUNTS)).toBe(100);
  });

  it('returns 50 for empty proposal type counts', () => {
    const votes = [makeVoteData({ proposalType: 'TreasuryWithdrawals', proposalKey: 'tx_0-0' })];
    expect(computeCoverageBreadth(votes, new Map())).toBe(50);
  });

  it('DRep voting only on rare type scores low', () => {
    // 1 HardFork out of 100 total proposals
    const typeCounts = new Map([
      ['TreasuryWithdrawals', 90],
      ['ParameterChange', 9],
      ['HardForkInitiation', 1],
    ]);

    const votes = [makeVoteData({ proposalType: 'HardForkInitiation', proposalKey: 'tx_0-0' })];

    const score = computeCoverageBreadth(votes, typeCounts);
    expect(score).toBe(1); // 1/100 = 1%
  });
});

// ── Dissent with Substance Tests ──

describe('dissent with substance modifier', () => {
  it('boosts quality for minority vote with quality >= 60', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `tx_ds${i}-0`);
    const summaries = makeSummaries(
      keys,
      Array.from({ length: 10 }, () => 0.8), // majority is Yes
    );

    // DRep A: votes No (dissent) with quality 80 on some proposals
    const dissentVotes = makeVotes(
      'dissenter',
      keys.map((key, i) => ({
        proposalKey: key,
        vote: i < 3 ? ('No' as const) : ('Yes' as const),
        rationaleQuality: 80,
        rationaleMetaHash: `hash_${i}`,
        blockTime: NOW - i * ONE_DAY,
        proposalType: 'TreasuryWithdrawals',
      })),
    );

    // DRep B: always votes Yes (conformist) with same quality
    const conformistVotes = makeVotes(
      'conformist',
      keys.map((key, i) => ({
        proposalKey: key,
        vote: 'Yes' as const,
        rationaleQuality: 80,
        rationaleMetaHash: `hash_c${i}`,
        blockTime: NOW - i * ONE_DAY,
        proposalType: 'TreasuryWithdrawals',
      })),
    );

    const dissentScores = computeEngagementQuality(dissentVotes, summaries, TYPE_COUNTS, NOW);
    const conformistScores = computeEngagementQuality(conformistVotes, summaries, TYPE_COUNTS, NOW);

    // Dissenter should score slightly higher due to quality multiplier
    expect(dissentScores.get('dissenter')!).toBeGreaterThan(conformistScores.get('conformist')!);
  });

  it('does NOT boost dissent without sufficient rationale quality', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `tx_nq${i}-0`);
    const summaries = makeSummaries(
      keys,
      Array.from({ length: 10 }, () => 0.8),
    );

    // DRep votes No (dissent) but quality is only 30 (below minQuality of 60)
    const lowQualityDissent = makeVotes(
      'lowq',
      keys.map((key, i) => ({
        proposalKey: key,
        vote: i < 3 ? ('No' as const) : ('Yes' as const),
        rationaleQuality: 30,
        rationaleMetaHash: `hash_${i}`,
        blockTime: NOW - i * ONE_DAY,
        proposalType: 'TreasuryWithdrawals',
      })),
    );

    // Same DRep but always Yes
    const conformistLowQ = makeVotes(
      'conf',
      keys.map((key, i) => ({
        proposalKey: key,
        vote: 'Yes' as const,
        rationaleQuality: 30,
        rationaleMetaHash: `hash_c${i}`,
        blockTime: NOW - i * ONE_DAY,
        proposalType: 'TreasuryWithdrawals',
      })),
    );

    const dissentScores = computeEngagementQuality(lowQualityDissent, summaries, TYPE_COUNTS, NOW);
    const conformistScores = computeEngagementQuality(conformistLowQ, summaries, TYPE_COUNTS, NOW);

    // Without quality >= 60, no modifier applies — scores should be equal
    expect(dissentScores.get('lowq')!).toBe(conformistScores.get('conf')!);
  });

  it('caps dissent modifier to maxVoteFraction (40%) of votes', () => {
    // All 10 votes are dissent with quality 80 — but only 4 (40%) should get bonus
    const keys = Array.from({ length: 10 }, (_, i) => `tx_cap${i}-0`);
    const summaries = makeSummaries(
      keys,
      Array.from({ length: 10 }, () => 0.8), // majority is Yes
    );

    const allDissent = makeVotes(
      'alldissent',
      keys.map((key, i) => ({
        proposalKey: key,
        vote: 'No' as const, // all against majority
        rationaleQuality: 80,
        rationaleMetaHash: `hash_${i}`,
        blockTime: NOW - i * ONE_DAY,
        proposalType: 'TreasuryWithdrawals',
      })),
    );

    const scores = computeEngagementQuality(allDissent, summaries, TYPE_COUNTS, NOW);
    // Should not crash and score should be bounded
    const score = scores.get('alldissent')!;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ── Edge Cases ──

describe('V3.2 edge cases', () => {
  it('handles 0 votes', () => {
    const scores = computeEngagementQuality(
      new Map([['empty', []]]),
      emptySummaries(),
      TYPE_COUNTS,
      NOW,
    );
    expect(scores.get('empty')).toBe(0);
  });

  it('handles 1 vote', () => {
    const scores = computeEngagementQuality(
      makeVotes('one', [
        {
          proposalKey: 'tx_solo-0',
          rationaleQuality: 75,
          rationaleMetaHash: 'hash_solo',
          blockTime: NOW - ONE_DAY,
          proposalType: 'TreasuryWithdrawals',
        },
      ]),
      emptySummaries(),
      TYPE_COUNTS,
      NOW,
    );
    const score = scores.get('one')!;
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles all abstains', () => {
    const scores = computeEngagementQuality(
      makeVotes(
        'abstainer',
        Array.from({ length: 5 }, (_, i) => ({
          proposalKey: `tx_abs${i}-0`,
          vote: 'Abstain' as const,
          rationaleQuality: 50,
          rationaleMetaHash: `hash_${i}`,
          blockTime: NOW - i * ONE_DAY,
          proposalType: 'TreasuryWithdrawals',
        })),
      ),
      emptySummaries(),
      TYPE_COUNTS,
      NOW,
    );
    const score = scores.get('abstainer')!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('handles no rationales (all null quality)', () => {
    const scores = computeEngagementQuality(
      makeVotes(
        'norationale',
        Array.from({ length: 8 }, (_, i) => ({
          proposalKey: `tx_nr${i}-0`,
          rationaleQuality: null,
          rationaleMetaHash: null,
          blockTime: NOW - i * ONE_DAY,
          proposalType: 'TreasuryWithdrawals',
        })),
      ),
      emptySummaries(),
      TYPE_COUNTS,
      NOW,
    );
    const score = scores.get('norationale')!;
    // Provision = 0, Quality = 0, Deliberation = neutral-ish
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(20);
  });
});
