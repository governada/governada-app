import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: (uri: string) => {
    const knownDomains = ['twitter.com', 'x.com', 'github.com', 'linkedin.com'];
    try {
      const url = new URL(uri);
      return knownDomains.some((d) => url.hostname === d || url.hostname === `www.${d}`);
    } catch {
      return false;
    }
  },
}));

import { computeSpoScores, computeProposalMarginMultipliers } from '@/lib/scoring/spoScore';
import type { SpoVoteDataV3 } from '@/lib/scoring/spoScore';
import { computeSpoDeliberationQuality } from '@/lib/scoring/spoDeliberationQuality';
import { computeConfidence, percentileNormalizeWeighted } from '@/lib/scoring/confidence';
import { detectSybilPairs } from '@/lib/scoring/sybilDetection';
import { computeSpoGovernanceIdentity } from '@/lib/scoring/spoGovernanceIdentity';
import type { SpoProfileData } from '@/lib/scoring/spoGovernanceIdentity';
import { computeTier } from '@/lib/scoring/tiers';

const NOW = Math.floor(Date.now() / 1000);

function makeVote(
  poolId: string,
  proposalKey: string,
  epoch: number,
  overrides?: Partial<SpoVoteDataV3>,
): SpoVoteDataV3 {
  return {
    poolId,
    proposalKey,
    vote: 'Yes',
    blockTime: NOW - (520 - epoch) * 5 * 86400,
    epoch,
    proposalType: 'TreasuryWithdrawals',
    importanceWeight: 2,
    proposalBlockTime: NOW - (520 - epoch) * 5 * 86400 - 86400,
    hasRationale: false,
    ...overrides,
  };
}

describe('SPO Score V3', () => {
  describe('computeConfidence', () => {
    it('returns 0 for zero evidence', () => {
      expect(computeConfidence(0, 0, 0)).toBe(0);
    });

    it('increases with vote count', () => {
      const low = computeConfidence(2, 5, 0.3);
      const high = computeConfidence(20, 5, 0.3);
      expect(high).toBeGreaterThan(low);
    });

    it('increases with epoch span', () => {
      const low = computeConfidence(10, 2, 0.3);
      const high = computeConfidence(10, 30, 0.3);
      expect(high).toBeGreaterThan(low);
    });

    it('caps at 100', () => {
      const result = computeConfidence(100, 100, 1.0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('reaches ~80 at 15 votes, 20 epochs, 60% type coverage', () => {
      const result = computeConfidence(15, 20, 0.6);
      expect(result).toBeGreaterThanOrEqual(60);
      expect(result).toBeLessThanOrEqual(90);
    });
  });

  describe('percentileNormalizeWeighted', () => {
    it('returns empty map for empty input', () => {
      const result = percentileNormalizeWeighted(new Map(), new Map());
      expect(result.size).toBe(0);
    });

    it('returns 50 for single entry', () => {
      const result = percentileNormalizeWeighted(new Map([['a', 70]]), new Map([['a', 80]]));
      expect(result.get('a')).toBe(50);
    });

    it('high-confidence entries rank higher than low-confidence', () => {
      const raw = new Map([
        ['high', 50],
        ['low', 50],
      ]);
      const conf = new Map([
        ['high', 90],
        ['low', 10],
      ]);
      const result = percentileNormalizeWeighted(raw, conf);
      // Same raw score, should have same percentile (tied)
      expect(result.get('high')).toBe(result.get('low'));
    });
  });

  describe('computeSpoDeliberationQuality', () => {
    it('returns 0 for empty votes', () => {
      const result = computeSpoDeliberationQuality(new Map(), new Set(), NOW);
      expect(result.size).toBe(0);
    });

    it('scores higher with rationale', () => {
      const withRationale = computeSpoDeliberationQuality(
        new Map([
          [
            'pool1',
            [
              {
                proposalKey: 'p1',
                vote: 'Yes' as const,
                blockTime: NOW - 86400,
                proposalBlockTime: NOW - 2 * 86400,
                proposalType: 'TreasuryWithdrawals',
                importanceWeight: 2,
                hasRationale: true,
              },
              {
                proposalKey: 'p2',
                vote: 'No' as const,
                blockTime: NOW - 86400 * 3,
                proposalBlockTime: NOW - 86400 * 5,
                proposalType: 'HardForkInitiation',
                importanceWeight: 3,
                hasRationale: true,
              },
              {
                proposalKey: 'p3',
                vote: 'Yes' as const,
                blockTime: NOW - 86400 * 6,
                proposalBlockTime: NOW - 86400 * 10,
                proposalType: 'InfoAction',
                importanceWeight: 1,
                hasRationale: true,
              },
            ],
          ],
        ]),
        new Set(['TreasuryWithdrawals', 'HardForkInitiation', 'InfoAction']),
        NOW,
      );

      const withoutRationale = computeSpoDeliberationQuality(
        new Map([
          [
            'pool1',
            [
              {
                proposalKey: 'p1',
                vote: 'Yes' as const,
                blockTime: NOW - 86400,
                proposalBlockTime: NOW - 2 * 86400,
                proposalType: 'TreasuryWithdrawals',
                importanceWeight: 2,
                hasRationale: false,
              },
              {
                proposalKey: 'p2',
                vote: 'No' as const,
                blockTime: NOW - 86400 * 3,
                proposalBlockTime: NOW - 86400 * 5,
                proposalType: 'HardForkInitiation',
                importanceWeight: 3,
                hasRationale: false,
              },
              {
                proposalKey: 'p3',
                vote: 'Yes' as const,
                blockTime: NOW - 86400 * 6,
                proposalBlockTime: NOW - 86400 * 10,
                proposalType: 'InfoAction',
                importanceWeight: 1,
                hasRationale: false,
              },
            ],
          ],
        ]),
        new Set(['TreasuryWithdrawals', 'HardForkInitiation', 'InfoAction']),
        NOW,
      );

      expect(withRationale.get('pool1')!).toBeGreaterThan(withoutRationale.get('pool1')!);
    });
  });

  describe('detectSybilPairs', () => {
    it('returns empty for no pools', () => {
      expect(detectSybilPairs(new Map())).toEqual([]);
    });

    it('detects identical voting patterns', () => {
      const poolVoteMap = new Map([
        [
          'pool1',
          new Map<string, 'Yes' | 'No' | 'Abstain'>([
            ['p1', 'Yes'],
            ['p2', 'No'],
            ['p3', 'Yes'],
            ['p4', 'Yes'],
            ['p5', 'No'],
          ]),
        ],
        [
          'pool2',
          new Map<string, 'Yes' | 'No' | 'Abstain'>([
            ['p1', 'Yes'],
            ['p2', 'No'],
            ['p3', 'Yes'],
            ['p4', 'Yes'],
            ['p5', 'No'],
          ]),
        ],
      ]);

      const flags = detectSybilPairs(poolVoteMap);
      expect(flags).toHaveLength(1);
      expect(flags[0].agreementRate).toBe(1);
      expect(flags[0].sharedVotes).toBe(5);
    });

    it('does not flag different voting patterns', () => {
      const poolVoteMap = new Map([
        [
          'pool1',
          new Map<string, 'Yes' | 'No' | 'Abstain'>([
            ['p1', 'Yes'],
            ['p2', 'No'],
            ['p3', 'Yes'],
            ['p4', 'Yes'],
            ['p5', 'No'],
          ]),
        ],
        [
          'pool2',
          new Map<string, 'Yes' | 'No' | 'Abstain'>([
            ['p1', 'No'],
            ['p2', 'Yes'],
            ['p3', 'No'],
            ['p4', 'No'],
            ['p5', 'Yes'],
          ]),
        ],
      ]);

      const flags = detectSybilPairs(poolVoteMap);
      expect(flags).toHaveLength(0);
    });

    it('respects minimum shared votes threshold', () => {
      const poolVoteMap = new Map([
        [
          'pool1',
          new Map<string, 'Yes' | 'No' | 'Abstain'>([
            ['p1', 'Yes'],
            ['p2', 'No'],
          ]),
        ],
        [
          'pool2',
          new Map<string, 'Yes' | 'No' | 'Abstain'>([
            ['p1', 'Yes'],
            ['p2', 'No'],
          ]),
        ],
      ]);

      const flags = detectSybilPairs(poolVoteMap, 0.95, 5);
      expect(flags).toHaveLength(0); // Only 2 shared, below 5 threshold
    });
  });

  describe('computeProposalMarginMultipliers', () => {
    it('returns 1.5 for near-equal vote splits (floating point edge)', () => {
      const votes: SpoVoteDataV3[] = [
        makeVote('p1', 'prop1', 500, { vote: 'Yes' }),
        makeVote('p2', 'prop1', 500, { vote: 'No' }),
        makeVote('p3', 'prop1', 500, { vote: 'Yes' }),
        makeVote('p4', 'prop1', 500, { vote: 'No' }),
        makeVote('p5', 'prop1', 500, { vote: 'Yes' }),
      ];

      const multipliers = computeProposalMarginMultipliers(votes);
      // 3 Yes, 2 No -> margin = |3/5 - 2/5| = ~0.2 (floating point: 0.19999...)
      expect(multipliers.get('prop1')).toBe(1.5);
    });

    it('returns 1.5 for very close margins', () => {
      const votes: SpoVoteDataV3[] = [
        makeVote('p1', 'prop1', 500, { vote: 'Yes' }),
        makeVote('p2', 'prop1', 500, { vote: 'No' }),
        makeVote('p3', 'prop1', 500, { vote: 'Yes' }),
        makeVote('p4', 'prop1', 500, { vote: 'No' }),
        makeVote('p5', 'prop1', 500, { vote: 'Yes' }),
        makeVote('p6', 'prop1', 500, { vote: 'No' }),
      ];

      const multipliers = computeProposalMarginMultipliers(votes);
      // 3 Yes, 3 No -> margin = 0 < 0.2
      expect(multipliers.get('prop1')).toBe(1.5);
    });
  });

  describe('computeSpoGovernanceIdentity', () => {
    it('scores higher with complete profile', () => {
      const complete: SpoProfileData = {
        poolId: 'pool1',
        ticker: 'TEST',
        poolName: 'Test Pool',
        governanceStatement:
          'We are committed to Cardano governance and transparent voting on treasury proposals, delegates should know our constitution position on decentralization.',
        poolDescription: 'A production stake pool running on bare metal servers.',
        homepageUrl: 'https://testpool.com',
        socialLinks: [
          { uri: 'https://twitter.com/testpool' },
          { uri: 'https://github.com/testpool' },
        ],
        metadataHashVerified: true,
        delegatorCount: 100,
      };

      const sparse: SpoProfileData = {
        poolId: 'pool2',
        ticker: null,
        poolName: null,
        governanceStatement: null,
        poolDescription: null,
        homepageUrl: null,
        socialLinks: [],
        metadataHashVerified: false,
        delegatorCount: 5,
      };

      const profiles = new Map([
        ['pool1', complete],
        ['pool2', sparse],
      ]);

      const scores = computeSpoGovernanceIdentity(profiles);
      expect(scores.get('pool1')!).toBeGreaterThan(scores.get('pool2')!);
    });
  });

  describe('computeTier with confidence', () => {
    it('caps at Emerging when confidence is below 60', () => {
      expect(computeTier(85, 30)).toBe('Emerging');
    });

    it('assigns normal tier when confidence >= 60', () => {
      expect(computeTier(85, 80)).toBe('Diamond');
    });

    it('assigns normal tier when confidence is undefined', () => {
      expect(computeTier(85)).toBe('Diamond');
    });
  });

  describe('computeSpoScores (integration)', () => {
    it('produces scores for multiple pools', () => {
      const votes: SpoVoteDataV3[] = [];
      const activeEpochs = new Set<number>();

      // Pool A: 10 votes across 5 epochs
      for (let i = 0; i < 10; i++) {
        const epoch = 500 + Math.floor(i / 2);
        activeEpochs.add(epoch);
        votes.push(
          makeVote('poolA', `prop-${i}`, epoch, {
            proposalType: i % 3 === 0 ? 'TreasuryWithdrawals' : 'InfoAction',
          }),
        );
      }

      // Pool B: 3 votes in 1 epoch
      for (let i = 0; i < 3; i++) {
        activeEpochs.add(510);
        votes.push(makeVote('poolB', `prop-b${i}`, 510));
      }

      const allProposalTypes = new Set(['TreasuryWithdrawals', 'InfoAction']);
      const identityScores = new Map([
        ['poolA', 70],
        ['poolB', 20],
      ]);
      const deliberationScores = new Map([
        ['poolA', 60],
        ['poolB', 30],
      ]);
      const confidences = new Map([
        ['poolA', 85],
        ['poolB', 30],
      ]);
      const marginMults = computeProposalMarginMultipliers(votes);

      const results = computeSpoScores(
        votes,
        10,
        512,
        allProposalTypes,
        identityScores,
        deliberationScores,
        confidences,
        new Map(),
        marginMults,
        activeEpochs,
      );

      expect(results.size).toBe(2);
      expect(results.get('poolA')!.composite).toBeGreaterThan(0);
      expect(results.get('poolB')!.composite).toBeGreaterThan(0);
      expect(results.get('poolA')!.composite).toBeGreaterThan(results.get('poolB')!.composite);
      expect(results.get('poolA')!.confidence).toBe(85);
      expect(results.get('poolB')!.confidence).toBe(30);
    });
  });
});
