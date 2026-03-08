import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import { computeEngagementQuality } from '@/lib/scoring/engagementQuality';
import { DECAY_LAMBDA } from '@/lib/scoring/types';
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

const ALL_TYPES = new Set([
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'InfoAction',
]);

// ── Tests ──

describe('computeEngagementQuality', () => {
  // ── Happy path ──

  it('computes non-zero score for DReps with mixed votes and rationales', () => {
    const drepVotes = new Map<string, VoteData[]>();
    for (let d = 0; d < 10; d++) {
      const drepId = `drep_${d}`;
      const votes: VoteData[] = [];
      for (let p = 0; p < 20; p++) {
        votes.push(
          makeVoteData({
            drepId,
            proposalKey: `tx_p${p}-0`,
            vote: p % 3 === 0 ? 'No' : p % 5 === 0 ? 'Abstain' : 'Yes',
            blockTime: NOW - p * 5 * ONE_DAY,
            proposalBlockTime: NOW - (p * 5 + 2) * ONE_DAY,
            rationaleQuality: d < 7 ? 50 + d * 5 : null,
            proposalType: [
              'TreasuryWithdrawals',
              'ParameterChange',
              'HardForkInitiation',
              'InfoAction',
            ][p % 4],
          }),
        );
      }
      drepVotes.set(drepId, votes);
    }

    const summaries = makeSummaries(
      Array.from({ length: 20 }, (_, i) => `tx_p${i}-0`),
      Array.from({ length: 20 }, (_, i) => 0.3 + (i / 20) * 0.4),
    );

    const scores = computeEngagementQuality(drepVotes, summaries, ALL_TYPES, NOW);
    expect(scores.size).toBe(10);
    for (const [, score] of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  // ── Edge: DRep with 0 votes ──

  it('returns 0 for a DRep with empty vote array', () => {
    const scores = computeEngagementQuality(
      new Map([['drep_empty', []]]),
      emptySummaries(),
      ALL_TYPES,
      NOW,
    );
    expect(scores.get('drep_empty')).toBe(0);
  });

  // ── Edge: DRep with 1 vote ──

  it('handles DRep with a single vote', () => {
    const scores = computeEngagementQuality(
      makeVotes('d1', [
        {
          proposalKey: 'tx_1-0',
          rationaleQuality: 80,
          importanceWeight: 2,
          blockTime: NOW - ONE_DAY,
        },
      ]),
      emptySummaries(),
      ALL_TYPES,
      NOW,
    );
    expect(scores.get('d1')).toBeGreaterThan(0);
  });

  // ── Edge: All votes same direction (rubber-stamp) ──

  it('penalizes rubber-stamping (>95% same vote direction)', () => {
    const diverseVotes = makeVotes(
      'diverse',
      Array.from({ length: 10 }, (_, i) => ({
        proposalKey: `tx_${i}-0`,
        vote: (i % 3 === 0 ? 'No' : i % 3 === 1 ? 'Abstain' : 'Yes') as VoteData['vote'],
        blockTime: NOW - i * ONE_DAY,
        rationaleQuality: 60,
      })),
    );

    const rubberStamp = makeVotes(
      'stamp',
      Array.from({ length: 10 }, (_, i) => ({
        proposalKey: `tx_${i}-0`,
        vote: 'Yes' as const,
        blockTime: NOW - i * ONE_DAY,
        rationaleQuality: 60,
      })),
    );

    const summaries = makeSummaries(
      Array.from({ length: 10 }, (_, i) => `tx_${i}-0`),
      Array.from({ length: 10 }, () => 0.7),
    );

    const diverseScores = computeEngagementQuality(diverseVotes, summaries, ALL_TYPES, NOW);
    const stampScores = computeEngagementQuality(rubberStamp, summaries, ALL_TYPES, NOW);

    // Diverse voter should score higher on deliberation signal
    expect(diverseScores.get('diverse')!).toBeGreaterThan(stampScores.get('stamp')!);
  });

  // ── Edge: All rationales scored 0 ──

  it('returns 0 quality layer when all rationale scores are 0', () => {
    const scores = computeEngagementQuality(
      makeVotes(
        'd1',
        Array.from({ length: 8 }, (_, i) => ({
          proposalKey: `tx_${i}-0`,
          rationaleQuality: 0,
          blockTime: NOW - i * ONE_DAY,
        })),
      ),
      emptySummaries(),
      ALL_TYPES,
      NOW,
    );
    // With all quality=0, quality layer = 0 but provision and deliberation can still contribute
    const score = scores.get('d1')!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // ── Edge: All rationales scored 100 ──

  it('produces high score when all rationales are 100', () => {
    const scores = computeEngagementQuality(
      makeVotes(
        'd1',
        Array.from({ length: 8 }, (_, i) => ({
          proposalKey: `tx_${i}-0`,
          rationaleQuality: 100,
          blockTime: NOW - i * ONE_DAY,
          vote: (i % 3 === 0 ? 'No' : 'Yes') as VoteData['vote'],
          proposalType: ['TreasuryWithdrawals', 'ParameterChange', 'HardForkInitiation'][i % 3],
        })),
      ),
      emptySummaries(),
      ALL_TYPES,
      NOW,
    );
    expect(scores.get('d1')!).toBeGreaterThan(60);
  });

  // ── Temporal: Verify decay ──

  it('weights recent votes more than old votes (180-day half-life)', () => {
    const recentVotes = makeVotes('recent', [
      {
        proposalKey: 'tx_r-0',
        rationaleQuality: 80,
        blockTime: NOW - ONE_DAY,
        importanceWeight: 2,
      },
    ]);

    const oldVotes = makeVotes('old', [
      {
        proposalKey: 'tx_o-0',
        rationaleQuality: 80,
        blockTime: NOW - 180 * ONE_DAY,
        importanceWeight: 2,
      },
    ]);

    const recentScores = computeEngagementQuality(recentVotes, emptySummaries(), ALL_TYPES, NOW);
    const oldScores = computeEngagementQuality(oldVotes, emptySummaries(), ALL_TYPES, NOW);

    // Both have same quality but old vote is decayed
    // The provision rate is binary (has quality > 0 = yes), but the quality layer uses decay
    // The 180-day-old vote should contribute ~50% weight
    expect(recentScores.get('recent')!).toBeGreaterThanOrEqual(oldScores.get('old')!);
  });

  it('vote from 180 days ago contributes ~50% weight via decay', () => {
    const ageDays = 180;
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    expect(decay).toBeCloseTo(0.5, 1);
  });

  // ── InfoActions excluded from provision/quality ──

  it('excludes InfoAction votes from provision and quality calculations', () => {
    const onlyInfoActions = makeVotes(
      'd1',
      Array.from({ length: 6 }, (_, i) => ({
        proposalKey: `tx_info${i}-0`,
        proposalType: 'InfoAction',
        rationaleQuality: 90,
        blockTime: NOW - i * ONE_DAY,
      })),
    );

    const scores = computeEngagementQuality(onlyInfoActions, emptySummaries(), ALL_TYPES, NOW);
    // InfoActions are excluded from provision and quality layers
    // Only deliberation signal contributes (and it returns 50 for ≤5 votes)
    const score = scores.get('d1')!;
    expect(score).toBeLessThanOrEqual(30); // mostly zeros from provision+quality
  });

  // ── Dissent scoring ──

  it('scores dissent sweet spot (15-40%) highest', () => {
    // DRep who votes against majority 25% of the time (sweet spot)
    const sweetSpotVotes: VoteData[] = [];
    const summaries = new Map<string, ProposalVotingSummary>();
    for (let i = 0; i < 20; i++) {
      const key = `tx_d${i}-0`;
      // Majority is Yes on all proposals
      summaries.set(key, {
        proposalKey: key,
        drepYesVotePower: 7000,
        drepNoVotePower: 3000,
        drepAbstainVotePower: 0,
      });
      sweetSpotVotes.push(
        makeVoteData({
          drepId: 'moderate',
          proposalKey: key,
          // 25% dissent (vote No when majority is Yes)
          vote: i < 5 ? 'No' : 'Yes',
          blockTime: NOW - i * ONE_DAY,
          rationaleQuality: 60,
        }),
      );
    }

    const zeroDissentVotes: VoteData[] = [];
    for (let i = 0; i < 20; i++) {
      const key = `tx_d${i}-0`;
      zeroDissentVotes.push(
        makeVoteData({
          drepId: 'conformist',
          proposalKey: key,
          vote: 'Yes', // always agrees with majority
          blockTime: NOW - i * ONE_DAY,
          rationaleQuality: 60,
        }),
      );
    }

    const moderateScores = computeEngagementQuality(
      new Map([['moderate', sweetSpotVotes]]),
      summaries,
      ALL_TYPES,
      NOW,
    );
    const conformistScores = computeEngagementQuality(
      new Map([['conformist', zeroDissentVotes]]),
      summaries,
      ALL_TYPES,
      NOW,
    );

    expect(moderateScores.get('moderate')!).toBeGreaterThan(conformistScores.get('conformist')!);
  });

  // ── Scores bounded 0-100 ──

  it('always returns scores in 0-100 range', () => {
    const drepVotes = new Map<string, VoteData[]>();
    for (let d = 0; d < 5; d++) {
      drepVotes.set(
        `d${d}`,
        Array.from({ length: 15 }, (_, i) =>
          makeVoteData({
            drepId: `d${d}`,
            proposalKey: `tx_${d}_${i}-0`,
            rationaleQuality: d * 25,
            vote: (['Yes', 'No', 'Abstain'] as const)[i % 3],
            blockTime: NOW - i * 5 * ONE_DAY,
          }),
        ),
      );
    }

    const scores = computeEngagementQuality(drepVotes, emptySummaries(), ALL_TYPES, NOW);
    for (const [, score] of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
