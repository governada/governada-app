import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import { computeReliability } from '@/lib/scoring/reliability';
import type { VoteData } from '@/lib/scoring/types';
import { makeVoteData, NOW, ONE_DAY, ONE_EPOCH } from '../fixtures/scoring';

// ── Helpers ──

function makeEpochData(
  counts: number[],
  firstEpoch: number,
): { counts: number[]; firstEpoch: number } {
  return { counts, firstEpoch };
}

function makeProposalEpochs(epochs: number[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const e of epochs) map.set(e, 1);
  return map;
}

function makeVotesForEpochs(drepId: string, epochs: number[]): VoteData[] {
  return epochs.map((epoch, i) =>
    makeVoteData({
      drepId,
      proposalKey: `tx_${drepId}_e${epoch}_${i}-0`,
      blockTime: NOW - (520 - epoch) * ONE_EPOCH + ONE_DAY,
      proposalBlockTime: NOW - (520 - epoch) * ONE_EPOCH,
    }),
  );
}

// ── Tests ──

describe('computeReliability', () => {
  const CURRENT_EPOCH = 520;

  // ── Happy path ──

  it('computes scores for multiple DReps with varied patterns', () => {
    const proposalEpochs = makeProposalEpochs([515, 516, 517, 518, 519, 520]);

    const drepVotes = new Map<string, VoteData[]>();
    const drepEpochData = new Map<string, { counts: number[]; firstEpoch: number }>();

    // Active DRep: votes every epoch
    drepVotes.set('active', makeVotesForEpochs('active', [515, 516, 517, 518, 519, 520]));
    drepEpochData.set('active', makeEpochData([1, 1, 1, 1, 1, 1], 515));

    // Sporadic DRep: votes every other epoch
    drepVotes.set('sporadic', makeVotesForEpochs('sporadic', [515, 517, 519]));
    drepEpochData.set('sporadic', makeEpochData([1, 0, 1, 0, 1, 0], 515));

    const scores = computeReliability(drepVotes, proposalEpochs, CURRENT_EPOCH, drepEpochData);
    expect(scores.size).toBe(2);
    expect(scores.get('active')!).toBeGreaterThan(scores.get('sporadic')!);
  });

  // ── Edge: DRep registered but never voted ──

  it('returns 0 for DRep with no votes', () => {
    const scores = computeReliability(
      new Map([['ghost', []]]),
      makeProposalEpochs([515, 516, 517]),
      CURRENT_EPOCH,
      new Map([['ghost', makeEpochData([], 515)]]),
    );
    expect(scores.get('ghost')).toBe(0);
  });

  it('returns 0 when epoch data is missing', () => {
    const votes = makeVotesForEpochs('missing', [518]);
    const scores = computeReliability(
      new Map([['missing', votes]]),
      makeProposalEpochs([515, 516, 517, 518]),
      CURRENT_EPOCH,
      new Map(), // no epoch data
    );
    expect(scores.get('missing')).toBe(0);
  });

  // ── Streak calculation ──

  it('rewards consecutive voting epochs with higher streak score', () => {
    const proposalEpochs = makeProposalEpochs([
      510, 511, 512, 513, 514, 515, 516, 517, 518, 519, 520,
    ]);

    // 10-epoch streak ending at current epoch
    const longStreakVotes = makeVotesForEpochs(
      'streak10',
      [511, 512, 513, 514, 515, 516, 517, 518, 519, 520],
    );
    const longStreakEpoch = makeEpochData([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 510);

    // 3-epoch streak ending at current epoch
    const shortStreakVotes = makeVotesForEpochs('streak3', [518, 519, 520]);
    const shortStreakEpoch = makeEpochData([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1], 510);

    const drepVotes = new Map([
      ['streak10', longStreakVotes],
      ['streak3', shortStreakVotes],
    ]);
    const drepEpochData = new Map([
      ['streak10', longStreakEpoch],
      ['streak3', shortStreakEpoch],
    ]);

    const scores = computeReliability(drepVotes, proposalEpochs, CURRENT_EPOCH, drepEpochData);
    expect(scores.get('streak10')!).toBeGreaterThan(scores.get('streak3')!);
  });

  // ── Gap penalty ──

  it('penalizes long gaps between voting epochs', () => {
    const proposalEpochs = makeProposalEpochs(Array.from({ length: 21 }, (_, i) => 500 + i));

    // No gap: votes every epoch 510-520
    const noGapVotes = makeVotesForEpochs(
      'noGap',
      Array.from({ length: 11 }, (_, i) => 510 + i),
    );
    const noGapData = makeEpochData(
      Array.from({ length: 21 }, (_, i) => (i >= 10 ? 1 : 0)),
      500,
    );

    // Big gap: votes epoch 500, then 520 (20-epoch gap)
    const bigGapVotes = makeVotesForEpochs('bigGap', [500, 520]);
    const bigGapData = makeEpochData(
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      500,
    );

    const scores = computeReliability(
      new Map([
        ['noGap', noGapVotes],
        ['bigGap', bigGapVotes],
      ]),
      proposalEpochs,
      CURRENT_EPOCH,
      new Map([
        ['noGap', noGapData],
        ['bigGap', bigGapData],
      ]),
    );

    expect(scores.get('noGap')!).toBeGreaterThan(scores.get('bigGap')!);
  });

  // ── Edge: Perfect streak then sudden inactivity ──

  it('penalizes sudden inactivity after a perfect streak', () => {
    const proposalEpochs = makeProposalEpochs(Array.from({ length: 21 }, (_, i) => 500 + i));

    // DRep voted every epoch 500-510, then stopped
    const staleDrepVotes = makeVotesForEpochs(
      'stale',
      Array.from({ length: 11 }, (_, i) => 500 + i),
    );
    const staleDrepData = makeEpochData(
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      500,
    );

    // DRep votes continuously up to current epoch
    const activeVotes = makeVotesForEpochs(
      'active',
      Array.from({ length: 21 }, (_, i) => 500 + i),
    );
    const activeData = makeEpochData(Array(21).fill(1), 500);

    const scores = computeReliability(
      new Map([
        ['stale', staleDrepVotes],
        ['active', activeVotes],
      ]),
      proposalEpochs,
      CURRENT_EPOCH,
      new Map([
        ['stale', staleDrepData],
        ['active', activeData],
      ]),
    );

    // Active should score much higher due to recency + streak + no gap
    expect(scores.get('active')!).toBeGreaterThan(scores.get('stale')!);
  });

  // ── Responsiveness ──

  it('rewards fast response time (voting soon after proposal)', () => {
    const proposalEpochs = makeProposalEpochs([518, 519, 520]);

    // Fast responder: votes within 1 day of proposal
    const fastVotes: VoteData[] = Array.from({ length: 3 }, (_, i) =>
      makeVoteData({
        drepId: 'fast',
        proposalKey: `tx_f${i}-0`,
        blockTime: NOW - (3 - i) * ONE_EPOCH + ONE_DAY, // 1 day after proposal
        proposalBlockTime: NOW - (3 - i) * ONE_EPOCH,
      }),
    );

    // Slow responder: votes 30 days after proposal
    const slowVotes: VoteData[] = Array.from({ length: 3 }, (_, i) =>
      makeVoteData({
        drepId: 'slow',
        proposalKey: `tx_s${i}-0`,
        blockTime: NOW - (3 - i) * ONE_EPOCH + 30 * ONE_DAY,
        proposalBlockTime: NOW - (3 - i) * ONE_EPOCH,
      }),
    );

    const scores = computeReliability(
      new Map([
        ['fast', fastVotes],
        ['slow', slowVotes],
      ]),
      proposalEpochs,
      CURRENT_EPOCH,
      new Map([
        ['fast', makeEpochData([1, 1, 1], 518)],
        ['slow', makeEpochData([1, 1, 1], 518)],
      ]),
    );

    expect(scores.get('fast')!).toBeGreaterThan(scores.get('slow')!);
  });

  // ── Scores bounded ──

  it('returns scores in 0-100 range', () => {
    const proposalEpochs = makeProposalEpochs([518, 519, 520]);
    const votes = makeVotesForEpochs('d1', [518, 519, 520]);

    const scores = computeReliability(
      new Map([['d1', votes]]),
      proposalEpochs,
      CURRENT_EPOCH,
      new Map([['d1', makeEpochData([1, 1, 1], 518)]]),
    );

    const score = scores.get('d1')!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
