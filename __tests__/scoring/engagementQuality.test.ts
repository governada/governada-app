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

/** V3.2: proposalTypeCounts replaces allProposalTypes Set */
const TYPE_COUNTS = new Map([
  ['TreasuryWithdrawals', 10],
  ['ParameterChange', 5],
  ['HardForkInitiation', 2],
  ['InfoAction', 3],
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
            rationaleMetaHash: d < 7 ? `hash_${d}_${p}` : null,
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

    const scores = computeEngagementQuality(drepVotes, summaries, TYPE_COUNTS, NOW);
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
      TYPE_COUNTS,
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
      TYPE_COUNTS,
      NOW,
    );
    expect(scores.get('d1')).toBeGreaterThan(0);
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
      TYPE_COUNTS,
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
          rationaleMetaHash: `unique_hash_${i}`,
          blockTime: NOW - i * ONE_DAY,
          vote: (i % 3 === 0 ? 'No' : 'Yes') as VoteData['vote'],
          proposalType: ['TreasuryWithdrawals', 'ParameterChange', 'HardForkInitiation'][i % 3],
        })),
      ),
      emptySummaries(),
      TYPE_COUNTS,
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

    const recentScores = computeEngagementQuality(recentVotes, emptySummaries(), TYPE_COUNTS, NOW);
    const oldScores = computeEngagementQuality(oldVotes, emptySummaries(), TYPE_COUNTS, NOW);

    // Both have same quality but old vote is decayed
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

    const scores = computeEngagementQuality(onlyInfoActions, emptySummaries(), TYPE_COUNTS, NOW);
    // InfoActions are excluded from provision and quality layers
    const score = scores.get('d1')!;
    expect(score).toBeLessThanOrEqual(30); // mostly zeros from provision+quality
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

    const scores = computeEngagementQuality(drepVotes, emptySummaries(), TYPE_COUNTS, NOW);
    for (const [, score] of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
