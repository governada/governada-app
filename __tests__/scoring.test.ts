import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: (uri: string) => {
    const knownDomains = ['twitter.com', 'x.com', 'github.com', 'linkedin.com', 'youtube.com'];
    try {
      const url = new URL(uri);
      return knownDomains.some((d) => url.hostname === d || url.hostname === `www.${d}`);
    } catch {
      return false;
    }
  },
}));

import {
  getSizeTier,
  getSizeBadgeClass,
  calculateParticipationRate,
  calculateRationaleRate,
  calculateDeliberationModifier,
  calculateReliability,
  calculateEffectiveParticipation,
  calculateProfileCompleteness,
  hasQualityRationale,
  calculateWeightedRationaleRate,
  applyRationaleCurve,
  lovelaceToAda,
  formatAda,
  getDRepScoreBadgeClass,
  getReliabilityHintFromStored,
  getPillarStatus,
  getMissingProfileFields,
  getEasiestWin,
  MIN_RATIONALE_LENGTH,
} from '@/utils/scoring';
import type { DRepVote } from '@/types/koios';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeVote(overrides: Partial<DRepVote> = {}): DRepVote {
  return {
    proposal_tx_hash: 'abc123',
    proposal_index: 0,
    vote_tx_hash: 'vtx_' + Math.random().toString(36).slice(2, 10),
    block_time: 1700000000,
    vote: 'Yes',
    meta_url: null,
    meta_hash: null,
    meta_json: null,
    ...overrides,
  };
}

// ── getSizeTier ──────────────────────────────────────────────────────────────

describe('getSizeTier', () => {
  it('returns Small for < 100k ADA', () => {
    expect(getSizeTier(0)).toBe('Small');
    expect(getSizeTier(99_999)).toBe('Small');
  });

  it('returns Medium for 100k - 5M ADA', () => {
    expect(getSizeTier(100_000)).toBe('Medium');
    expect(getSizeTier(4_999_999)).toBe('Medium');
  });

  it('returns Large for 5M - 50M ADA', () => {
    expect(getSizeTier(5_000_000)).toBe('Large');
    expect(getSizeTier(49_999_999)).toBe('Large');
  });

  it('returns Whale for >= 50M ADA', () => {
    expect(getSizeTier(50_000_000)).toBe('Whale');
    expect(getSizeTier(500_000_000)).toBe('Whale');
  });
});

// ── getSizeBadgeClass ────────────────────────────────────────────────────────

describe('getSizeBadgeClass', () => {
  it('returns distinct class strings for each tier', () => {
    const tiers = ['Small', 'Medium', 'Large', 'Whale'] as const;
    const classes = tiers.map(getSizeBadgeClass);
    expect(new Set(classes).size).toBe(4);
    classes.forEach((c) => expect(c).toContain('bg-'));
  });
});

// ── calculateParticipationRate ───────────────────────────────────────────────

describe('calculateParticipationRate', () => {
  it('returns 0 when totalProposals is 0', () => {
    expect(calculateParticipationRate(5, 0)).toBe(0);
  });

  it('caps at 100%', () => {
    expect(calculateParticipationRate(150, 100)).toBe(100);
  });

  it('calculates correct percentage', () => {
    expect(calculateParticipationRate(50, 100)).toBe(50);
    expect(calculateParticipationRate(3, 4)).toBe(75);
  });

  it('handles 0 votes cast', () => {
    expect(calculateParticipationRate(0, 50)).toBe(0);
  });
});

// ── calculateRationaleRate ───────────────────────────────────────────────────

describe('calculateRationaleRate', () => {
  it('returns 0 for empty array', () => {
    expect(calculateRationaleRate([])).toBe(0);
  });

  it('counts meta_url as having rationale', () => {
    const votes = [
      makeVote({ meta_url: 'https://example.com/rationale.json' }),
      makeVote({ meta_url: null }),
    ];
    expect(calculateRationaleRate(votes)).toBe(50);
  });

  it('counts meta_json rationale fields', () => {
    const votes = [
      makeVote({ meta_json: { body: { comment: 'I approve this' } } }),
      makeVote({ meta_json: { rationale: 'Good proposal' } }),
      makeVote(),
    ];
    expect(calculateRationaleRate(votes)).toBe(67);
  });

  it('handles VoteRecord format', () => {
    const records = [{ hasRationale: true } as any, { hasRationale: false } as any];
    expect(calculateRationaleRate(records)).toBe(50);
  });
});

// ── calculateDeliberationModifier ────────────────────────────────────────────

describe('calculateDeliberationModifier', () => {
  it('returns 1.0 for <= 10 total votes (bypass threshold)', () => {
    expect(calculateDeliberationModifier(10, 0, 0)).toBe(1.0);
    expect(calculateDeliberationModifier(5, 3, 2)).toBe(1.0);
  });

  it('returns 0.70 for > 95% dominant', () => {
    expect(calculateDeliberationModifier(20, 0, 0)).toBe(0.7);
  });

  it('returns 0.85 for 90-95% dominant', () => {
    expect(calculateDeliberationModifier(19, 1, 0)).toBe(0.85);
  });

  it('returns 0.95 for 85-90% dominant', () => {
    expect(calculateDeliberationModifier(18, 1, 1)).toBe(0.95);
  });

  it('returns 1.0 for < 85% dominant', () => {
    expect(calculateDeliberationModifier(15, 3, 2)).toBe(1.0);
  });
});

// ── calculateReliability ─────────────────────────────────────────────────────

describe('calculateReliability', () => {
  it('returns zero result for empty epochVoteCounts', () => {
    const result = calculateReliability([], undefined, 100);
    expect(result.score).toBe(0);
    expect(result.streak).toBe(0);
  });

  it('returns zero result for undefined firstEpoch', () => {
    const result = calculateReliability([1, 2], undefined, 100);
    expect(result.score).toBe(0);
  });

  it('returns zero when all epoch vote counts are 0', () => {
    const result = calculateReliability([0, 0, 0], 95, 100);
    expect(result.score).toBe(0);
  });

  it('computes high score for consistent voter', () => {
    const counts = Array(20).fill(3);
    const result = calculateReliability(counts, 80, 99);
    expect(result.score).toBeGreaterThan(70);
    expect(result.streak).toBeGreaterThan(0);
    expect(result.tenure).toBe(19);
  });

  it('computes low recency for recent voter', () => {
    const counts = [0, 0, 0, 0, 1];
    const result = calculateReliability(counts, 96, 100);
    expect(result.recency).toBe(0);
  });

  it('computes gap penalty correctly', () => {
    const counts = [5, 0, 0, 0, 0, 0, 5];
    const result = calculateReliability(counts, 90, 96);
    expect(result.longestGap).toBe(5);
  });

  it('respects proposalEpochs filter', () => {
    const proposalEpochs = new Map([
      [95, 1],
      [96, 0],
      [97, 1],
    ]);
    const counts = [0, 0, 1, 0, 0];
    const result = calculateReliability(counts, 95, 99, proposalEpochs);
    expect(result.score).toBeGreaterThan(0);
  });
});

// ── calculateEffectiveParticipation ──────────────────────────────────────────

describe('calculateEffectiveParticipation', () => {
  it('multiplies participation rate by modifier', () => {
    expect(calculateEffectiveParticipation(80, 1.0)).toBe(80);
    expect(calculateEffectiveParticipation(80, 0.7)).toBe(56);
    expect(calculateEffectiveParticipation(100, 0.85)).toBe(85);
  });

  it('handles zero participation', () => {
    expect(calculateEffectiveParticipation(0, 1.0)).toBe(0);
  });
});

// ── calculateProfileCompleteness ─────────────────────────────────────────────

describe('calculateProfileCompleteness', () => {
  it('returns 0 for null metadata', () => {
    expect(calculateProfileCompleteness(null)).toBe(0);
  });

  it('returns 0 for empty metadata', () => {
    expect(calculateProfileCompleteness({})).toBe(0);
  });

  it('scores givenName (15pts)', () => {
    expect(calculateProfileCompleteness({ givenName: 'Alice' })).toBe(15);
  });

  it('scores name as fallback for givenName (15pts)', () => {
    expect(calculateProfileCompleteness({ name: 'Alice' })).toBe(15);
  });

  it('gives 30pts for 2+ validated social links', () => {
    const metadata = {
      references: [
        { uri: 'https://twitter.com/alice', label: 'Twitter' },
        { uri: 'https://github.com/alice', label: 'GitHub' },
      ],
    };
    expect(calculateProfileCompleteness(metadata)).toBe(30);
  });

  it('gives 25pts for 1 validated social link', () => {
    const metadata = {
      references: [
        { uri: 'https://twitter.com/alice', label: 'Twitter' },
        { uri: 'https://unknown.example.com', label: 'Blog' },
      ],
    };
    expect(calculateProfileCompleteness(metadata)).toBe(25);
  });

  it('skips broken URIs', () => {
    const brokenUris = new Set(['https://twitter.com/alice']);
    const metadata = {
      references: [
        { uri: 'https://twitter.com/alice', label: 'Twitter' },
        { uri: 'https://github.com/alice', label: 'GitHub' },
      ],
    };
    expect(calculateProfileCompleteness(metadata, brokenUris)).toBe(25);
  });

  it('deduplicates URIs', () => {
    const metadata = {
      references: [
        { uri: 'https://twitter.com/alice', label: 'Twitter' },
        { uri: 'https://twitter.com/alice', label: 'Twitter 2' },
        { uri: 'https://github.com/alice', label: 'GitHub' },
      ],
    };
    expect(calculateProfileCompleteness(metadata)).toBe(30);
  });

  it('scores all fields to max (100)', () => {
    const metadata = {
      givenName: 'Alice',
      objectives: 'Build better governance',
      motivations: 'Community service',
      qualifications: 'PhD in CS',
      bio: 'Cardano builder since 2020',
      references: [
        { uri: 'https://twitter.com/alice', label: 'Twitter' },
        { uri: 'https://github.com/alice', label: 'GitHub' },
      ],
    };
    expect(calculateProfileCompleteness(metadata)).toBe(100);
  });

  it('handles JSON-LD @value format', () => {
    const metadata = {
      givenName: { '@value': 'Alice' },
    };
    expect(calculateProfileCompleteness(metadata)).toBe(15);
  });
});

// ── hasQualityRationale ──────────────────────────────────────────────────────

describe('hasQualityRationale', () => {
  it('returns true for resolved text >= MIN_RATIONALE_LENGTH', () => {
    expect(hasQualityRationale(makeVote(), 'a'.repeat(MIN_RATIONALE_LENGTH))).toBe(true);
  });

  it('returns false for short resolved text', () => {
    expect(hasQualityRationale(makeVote(), 'short')).toBe(false);
  });

  it('returns true for inline rationale >= MIN_RATIONALE_LENGTH', () => {
    const vote = makeVote({
      meta_json: { body: { comment: 'a'.repeat(MIN_RATIONALE_LENGTH) } },
    });
    expect(hasQualityRationale(vote)).toBe(true);
  });

  it('returns true for meta_url (benefit of the doubt)', () => {
    const vote = makeVote({ meta_url: 'https://example.com/rationale.json' });
    expect(hasQualityRationale(vote)).toBe(true);
  });

  it('returns false for vote with nothing', () => {
    expect(hasQualityRationale(makeVote())).toBe(false);
  });
});

// ── calculateWeightedRationaleRate ───────────────────────────────────────────

describe('calculateWeightedRationaleRate', () => {
  it('returns 0 for empty votes', () => {
    expect(calculateWeightedRationaleRate([], new Map())).toBe(0);
  });

  it('weights critical proposals at 3x', () => {
    const map = new Map([
      ['tx1-0', { proposalType: 'HardForkInitiation', treasuryTier: null }],
      ['tx2-0', { proposalType: 'InfoAction', treasuryTier: null }],
    ]);
    const votes = [
      makeVote({ proposal_tx_hash: 'tx1', proposal_index: 0, meta_url: 'https://r.com' }),
      makeVote({ proposal_tx_hash: 'tx2', proposal_index: 0 }),
    ];
    const rate = calculateWeightedRationaleRate(votes, map as any);
    expect(rate).toBe(100); // tx2 is InfoAction (exempt), tx1 has rationale = 100%
  });

  it('excludes InfoAction proposals from calculation', () => {
    const map = new Map([['tx1-0', { proposalType: 'InfoAction', treasuryTier: null }]]);
    const votes = [makeVote({ proposal_tx_hash: 'tx1', proposal_index: 0 })];
    const rate = calculateWeightedRationaleRate(votes, map as any);
    expect(rate).toBe(0); // totalWeight = 0 -> returns 0
  });
});

// ── applyRationaleCurve ──────────────────────────────────────────────────────

describe('applyRationaleCurve', () => {
  it('maps 0 to 0', () => {
    expect(applyRationaleCurve(0)).toBe(0);
  });

  it('maps 20% raw to 30 adjusted', () => {
    expect(applyRationaleCurve(20)).toBe(30);
  });

  it('maps 60% raw to 70 adjusted', () => {
    expect(applyRationaleCurve(60)).toBe(70);
  });

  it('maps 100% raw to 100 adjusted', () => {
    expect(applyRationaleCurve(100)).toBe(100);
  });

  it('clamps negative input to 0', () => {
    expect(applyRationaleCurve(-10)).toBe(0);
  });

  it('clamps >100 input to 100', () => {
    expect(applyRationaleCurve(150)).toBe(100);
  });

  it('rewards early effort (10% raw > 10 adjusted)', () => {
    expect(applyRationaleCurve(10)).toBeGreaterThan(10);
  });
});

// ── lovelaceToAda ────────────────────────────────────────────────────────────

describe('lovelaceToAda', () => {
  it('converts lovelace to ADA', () => {
    expect(lovelaceToAda('1000000')).toBe(1);
    expect(lovelaceToAda('5000000000')).toBe(5000);
  });

  it('returns NaN for invalid input', () => {
    expect(lovelaceToAda('not-a-number')).toBeNaN();
  });

  it('handles zero', () => {
    expect(lovelaceToAda('0')).toBe(0);
  });
});

// ── formatAda ────────────────────────────────────────────────────────────────

describe('formatAda', () => {
  it('formats with commas', () => {
    const result = formatAda(1234567);
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('567');
  });

  it('handles decimal values', () => {
    const result = formatAda(1.5);
    expect(result).toBe('1.5');
  });
});

// ── Color and badge utilities ────────────────────────────────────────────────

describe('getDRepScoreBadgeClass', () => {
  it('returns green for >= 80', () => {
    expect(getDRepScoreBadgeClass(80)).toContain('green');
  });

  it('returns amber for 60-79', () => {
    expect(getDRepScoreBadgeClass(70)).toContain('amber');
  });

  it('returns red for < 60', () => {
    expect(getDRepScoreBadgeClass(30)).toContain('red');
  });
});

// ── getReliabilityHintFromStored ─────────────────────────────────────────────

describe('getReliabilityHintFromStored', () => {
  it('shows "Last voted X epochs ago" for recency > 5', () => {
    expect(getReliabilityHintFromStored(0, 10)).toBe('Last voted 10 epochs ago');
  });

  it('shows streak info for streak >= 3 and recency <= 5', () => {
    expect(getReliabilityHintFromStored(5, 0)).toBe('5-epoch active streak');
  });

  it('shows "Voted this epoch" for recency = 0 and streak < 3', () => {
    expect(getReliabilityHintFromStored(1, 0)).toBe('Voted this epoch');
  });

  it('handles singular epoch', () => {
    expect(getReliabilityHintFromStored(0, 1)).toBe('Last voted 1 epoch ago');
  });
});

// ── getPillarStatus ──────────────────────────────────────────────────────────

describe('getPillarStatus', () => {
  it('returns "strong" for >= 80', () => {
    expect(getPillarStatus(80)).toBe('strong');
    expect(getPillarStatus(100)).toBe('strong');
  });

  it('returns "needs-work" for 50-79', () => {
    expect(getPillarStatus(50)).toBe('needs-work');
    expect(getPillarStatus(79)).toBe('needs-work');
  });

  it('returns "low" for < 50', () => {
    expect(getPillarStatus(0)).toBe('low');
    expect(getPillarStatus(49)).toBe('low');
  });
});

// ── getMissingProfileFields ──────────────────────────────────────────────────

describe('getMissingProfileFields', () => {
  it('returns all fields for null metadata', () => {
    const missing = getMissingProfileFields(null);
    expect(missing).toContain('name');
    expect(missing).toContain('objectives');
    expect(missing).toContain('social links');
    expect(missing.length).toBe(6);
  });

  it('returns empty array for complete profile', () => {
    const metadata = {
      givenName: 'Alice',
      objectives: 'Build',
      motivations: 'Service',
      qualifications: 'PhD',
      bio: 'Builder',
      references: [
        { uri: 'https://twitter.com/alice', label: 'Twitter' },
        { uri: 'https://github.com/alice', label: 'GitHub' },
      ],
    };
    expect(getMissingProfileFields(metadata)).toEqual([]);
  });

  it('suggests second social link when only one exists', () => {
    const metadata = {
      givenName: 'Alice',
      objectives: 'Build',
      motivations: 'Service',
      qualifications: 'PhD',
      bio: 'Builder',
      references: [{ uri: 'https://twitter.com/alice', label: 'Twitter' }],
    };
    const missing = getMissingProfileFields(metadata);
    expect(missing).toContain('a second social link (2+ recommended)');
  });
});

// ── getEasiestWin ────────────────────────────────────────────────────────────

describe('getEasiestWin', () => {
  it('returns null when all pillars are strong', () => {
    const pillars = [
      { label: 'Participation', value: 90, maxPoints: 30 },
      { label: 'Rationale', value: 85, maxPoints: 35 },
    ];
    expect(getEasiestWin(pillars)).toBeNull();
  });

  it('identifies the highest gain pillar', () => {
    const pillars = [
      { label: 'Participation', value: 70, maxPoints: 30 },
      { label: 'Rationale', value: 30, maxPoints: 35 },
    ];
    const result = getEasiestWin(pillars);
    expect(result).toContain('Rationale');
  });

  it('handles all pillars being low', () => {
    const pillars = [{ label: 'Profile', value: 20, maxPoints: 15 }];
    const result = getEasiestWin(pillars);
    expect(result).toContain('Profile');
    expect(result).toContain('Needs Work');
  });
});
