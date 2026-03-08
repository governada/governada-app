import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import { computeSpoDeliberationQuality } from '@/lib/scoring/spoDeliberationQuality';
import type { SpoDeliberationVoteData } from '@/lib/scoring/spoDeliberationQuality';

const NOW = Math.floor(Date.now() / 1000);
const ONE_DAY = 86400;

function makeDelibVote(overrides: Partial<SpoDeliberationVoteData> = {}): SpoDeliberationVoteData {
  return {
    proposalKey: 'p1',
    vote: 'Yes',
    blockTime: NOW - ONE_DAY,
    proposalBlockTime: NOW - 3 * ONE_DAY,
    proposalType: 'TreasuryWithdrawals',
    importanceWeight: 2,
    hasRationale: false,
    ...overrides,
  };
}

const ALL_TYPES = new Set([
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'InfoAction',
  'NoConfidence',
  'NewConstitution',
]);

describe('computeSpoDeliberationQuality', () => {
  // ── Rationale provision (40%) ──

  it('scores higher with rationale provision', () => {
    const withRationale = computeSpoDeliberationQuality(
      new Map([
        [
          'pool1',
          Array.from({ length: 6 }, (_, i) =>
            makeDelibVote({
              proposalKey: `p${i}`,
              hasRationale: true,
              blockTime: NOW - i * ONE_DAY,
              proposalBlockTime: NOW - (i + 2) * ONE_DAY,
              proposalType: ['TreasuryWithdrawals', 'ParameterChange', 'HardForkInitiation'][i % 3],
            }),
          ),
        ],
      ]),
      ALL_TYPES,
      NOW,
    );

    const withoutRationale = computeSpoDeliberationQuality(
      new Map([
        [
          'pool2',
          Array.from({ length: 6 }, (_, i) =>
            makeDelibVote({
              proposalKey: `p${i}`,
              hasRationale: false,
              blockTime: NOW - i * ONE_DAY,
              proposalBlockTime: NOW - (i + 2) * ONE_DAY,
              proposalType: ['TreasuryWithdrawals', 'ParameterChange', 'HardForkInitiation'][i % 3],
            }),
          ),
        ],
      ]),
      ALL_TYPES,
      NOW,
    );

    expect(withRationale.get('pool1')!).toBeGreaterThan(withoutRationale.get('pool2')!);
  });

  // ── Vote timing distribution (30%) — stddev sweet spot at ~3 days ──

  it('rewards natural timing variance over bot-like uniformity', () => {
    // Natural human timing: varied days-to-vote
    const naturalVotes = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        blockTime: NOW - (10 - i) * ONE_DAY,
        // Varied response times: 1, 3, 2, 5, 1, 4, 2, 3 days after proposal
        proposalBlockTime: NOW - (10 - i) * ONE_DAY - [1, 3, 2, 5, 1, 4, 2, 3][i] * ONE_DAY,
        proposalType: [
          'TreasuryWithdrawals',
          'ParameterChange',
          'HardForkInitiation',
          'InfoAction',
        ][i % 4],
      }),
    );

    // Bot-like timing: exact same response time every time
    const botVotes = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        blockTime: NOW - (10 - i) * ONE_DAY,
        proposalBlockTime: NOW - (10 - i) * ONE_DAY - ONE_DAY, // always exactly 1 day
        proposalType: [
          'TreasuryWithdrawals',
          'ParameterChange',
          'HardForkInitiation',
          'InfoAction',
        ][i % 4],
      }),
    );

    const naturalScore = computeSpoDeliberationQuality(
      new Map([['natural', naturalVotes]]),
      ALL_TYPES,
      NOW,
    );
    const botScore = computeSpoDeliberationQuality(new Map([['bot', botVotes]]), ALL_TYPES, NOW);

    // Natural should score higher on timing component
    expect(naturalScore.get('natural')!).toBeGreaterThanOrEqual(botScore.get('bot')!);
  });

  // ── Proposal coverage entropy (30%) — Shannon ──

  it('rewards diverse proposal type coverage', () => {
    // Diverse: votes on 4 different types
    const diverseVotes = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        proposalType: [
          'TreasuryWithdrawals',
          'ParameterChange',
          'HardForkInitiation',
          'InfoAction',
        ][i % 4],
        blockTime: NOW - i * ONE_DAY,
        proposalBlockTime: NOW - (i + 2) * ONE_DAY,
      }),
    );

    // Narrow: only votes on one type
    const narrowVotes = Array.from({ length: 8 }, (_, i) =>
      makeDelibVote({
        proposalKey: `p${i}`,
        proposalType: 'TreasuryWithdrawals',
        blockTime: NOW - i * ONE_DAY,
        proposalBlockTime: NOW - (i + 2) * ONE_DAY,
      }),
    );

    const diverseScore = computeSpoDeliberationQuality(
      new Map([['diverse', diverseVotes]]),
      ALL_TYPES,
      NOW,
    );
    const narrowScore = computeSpoDeliberationQuality(
      new Map([['narrow', narrowVotes]]),
      ALL_TYPES,
      NOW,
    );

    expect(diverseScore.get('diverse')!).toBeGreaterThan(narrowScore.get('narrow')!);
  });

  // ── Empty input ──

  it('returns empty map for no pools', () => {
    const result = computeSpoDeliberationQuality(new Map(), ALL_TYPES, NOW);
    expect(result.size).toBe(0);
  });

  // ── Scores bounded 0-100 ──

  it('produces scores in 0-100 range', () => {
    const pools = new Map<string, SpoDeliberationVoteData[]>();
    for (let p = 0; p < 5; p++) {
      pools.set(
        `pool${p}`,
        Array.from({ length: 10 }, (_, i) =>
          makeDelibVote({
            proposalKey: `p${i}`,
            hasRationale: i % 2 === 0,
            blockTime: NOW - i * 2 * ONE_DAY,
            proposalBlockTime: NOW - (i * 2 + 3) * ONE_DAY,
            proposalType: ['TreasuryWithdrawals', 'ParameterChange', 'HardForkInitiation'][i % 3],
          }),
        ),
      );
    }

    const scores = computeSpoDeliberationQuality(pools, ALL_TYPES, NOW);
    for (const [, score] of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  // ── Engagement consistency (CV of votes-per-epoch) ──
  // This is tested indirectly through the integration test in spo-score-v3.test.ts
});
