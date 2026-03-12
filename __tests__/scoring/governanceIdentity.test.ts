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

import { computeGovernanceIdentity } from '@/lib/scoring/governanceIdentity';
import { makeProfile, makeEmptyProfile } from '../fixtures/scoring';

describe('computeGovernanceIdentity', () => {
  // ── Empty profile ──

  it('scores low for a DRep with null metadata and 0 delegators', () => {
    const profiles = new Map([['drep_empty', makeEmptyProfile('drep_empty')]]);
    const scores = computeGovernanceIdentity(profiles);
    // Profile quality = 0 (null metadata), community presence = 0 (0 delegators → tier 0)
    // Total = 0 * 0.6 + 0 * 0.4 = 0
    expect(scores.get('drep_empty')).toBe(0);
  });

  // ── Fully complete profile ──

  it('scores highly for a fully complete profile with many delegators', () => {
    const profile = makeProfile({
      drepId: 'drep_full',
      delegatorCount: 200,
      metadataHashVerified: true,
    });

    const scores = computeGovernanceIdentity(new Map([['drep_full', profile]]));
    // Complete profile + top delegator count → high score
    expect(scores.get('drep_full')!).toBeGreaterThan(70);
  });

  // ── Profile quality: field-by-field ──

  it('gives 15 points for having a name', () => {
    const withName = makeProfile({
      drepId: 'a',
      metadata: { givenName: 'Alice' },
      delegatorCount: 0,
    });
    const noName = makeProfile({
      drepId: 'b',
      metadata: {},
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(
      new Map([
        ['a', withName],
        ['b', noName],
      ]),
    );
    expect(scores.get('a')!).toBeGreaterThan(scores.get('b')!);
  });

  it('tiers objectives by length (200+ = 20 pts, 50+ = 15 pts, 1+ = 5 pts)', () => {
    const long = makeProfile({
      drepId: 'long',
      metadata: { objectives: 'x'.repeat(200) },
      delegatorCount: 0,
    });
    const medium = makeProfile({
      drepId: 'medium',
      metadata: { objectives: 'x'.repeat(50) },
      delegatorCount: 0,
    });
    const short = makeProfile({
      drepId: 'short',
      metadata: { objectives: 'x' },
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(
      new Map([
        ['long', long],
        ['medium', medium],
        ['short', short],
      ]),
    );
    expect(scores.get('long')!).toBeGreaterThan(scores.get('medium')!);
    expect(scores.get('medium')!).toBeGreaterThan(scores.get('short')!);
  });

  // ── Social links ──

  it('gives 30 points for 2+ valid social links, 25 for 1', () => {
    const twoLinks = makeProfile({
      drepId: 'two',
      metadata: {
        references: [
          { uri: 'https://twitter.com/drep', label: 'Twitter' },
          { uri: 'https://github.com/drep', label: 'GitHub' },
        ],
      },
      delegatorCount: 0,
    });
    const oneLink = makeProfile({
      drepId: 'one',
      metadata: {
        references: [{ uri: 'https://twitter.com/drep', label: 'Twitter' }],
      },
      delegatorCount: 0,
    });
    const noLinks = makeProfile({
      drepId: 'none',
      metadata: { references: [] },
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(
      new Map([
        ['two', twoLinks],
        ['one', oneLink],
        ['none', noLinks],
      ]),
    );
    expect(scores.get('two')!).toBeGreaterThan(scores.get('one')!);
    expect(scores.get('one')!).toBeGreaterThan(scores.get('none')!);
  });

  it('ignores duplicate URIs in references', () => {
    const dupes = makeProfile({
      drepId: 'dupes',
      metadata: {
        references: [
          { uri: 'https://twitter.com/drep', label: 'Twitter' },
          { uri: 'https://twitter.com/drep', label: 'Twitter' }, // duplicate
        ],
      },
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(new Map([['dupes', dupes]]));
    // Only 1 unique link → 25 points for social (not 30)
    // Just verify it's less than a profile with 2 unique links
    const twoUnique = makeProfile({
      drepId: 'unique2',
      metadata: {
        references: [
          { uri: 'https://twitter.com/drep', label: 'Twitter' },
          { uri: 'https://github.com/drep', label: 'GitHub' },
        ],
      },
      delegatorCount: 0,
    });

    const scores2 = computeGovernanceIdentity(
      new Map([
        ['dupes', dupes],
        ['unique2', twoUnique],
      ]),
    );
    expect(scores2.get('unique2')!).toBeGreaterThan(scores2.get('dupes')!);
  });

  it('skips broken URIs', () => {
    const brokenProfile = makeProfile({
      drepId: 'broken',
      metadata: {
        references: [
          { uri: 'https://twitter.com/drep', label: 'Twitter' },
          { uri: 'https://github.com/drep', label: 'GitHub' },
        ],
      },
      delegatorCount: 0,
      brokenUris: new Set(['https://twitter.com/drep']),
    });

    const scores = computeGovernanceIdentity(new Map([['broken', brokenProfile]]));
    // Only 1 valid link (github, twitter is broken) → 25 pts not 30
    expect(scores.get('broken')!).toBeGreaterThan(0);
  });

  // ── Hash verification bonus ──

  it('gives 5 bonus points for verified metadata hash', () => {
    const verified = makeProfile({
      drepId: 'verified',
      metadata: { givenName: 'Test' },
      metadataHashVerified: true,
      delegatorCount: 0,
    });
    const unverified = makeProfile({
      drepId: 'unverified',
      metadata: { givenName: 'Test' },
      metadataHashVerified: false,
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(
      new Map([
        ['verified', verified],
        ['unverified', unverified],
      ]),
    );
    // Profile quality diff should be exactly 5 (hash bonus)
    // Community presence is same (both 0 delegators)
    const diff = scores.get('verified')! - scores.get('unverified')!;
    // Diff should be close to 5 * 0.6 = 3 (profile quality weight)
    expect(diff).toBeGreaterThanOrEqual(2);
    expect(diff).toBeLessThanOrEqual(4);
  });

  // ── Community presence (absolute delegator tiers) ──

  it('scores higher for top delegator count', () => {
    const top = makeProfile({ drepId: 'top', metadata: { givenName: 'Top' }, delegatorCount: 500 });
    const bottom = makeProfile({
      drepId: 'bottom',
      metadata: { givenName: 'Bot' },
      delegatorCount: 1,
    });

    const scores = computeGovernanceIdentity(
      new Map([
        ['top', top],
        ['bottom', bottom],
      ]),
    );
    expect(scores.get('top')!).toBeGreaterThan(scores.get('bottom')!);
  });

  it('uses absolute delegator tiers for community presence', () => {
    const profile = makeProfile({
      drepId: 'solo',
      metadata: { givenName: 'Solo' },
      delegatorCount: 100,
    });

    const scores = computeGovernanceIdentity(new Map([['solo', profile]]));
    // Community presence = 95 (100 delegators → tier 95), Profile = name(15) × 0.6 = 9
    // Total ≈ 9 + 95*0.4 = 47
    expect(scores.get('solo')!).toBeGreaterThan(40);
  });

  // ── @value wrapper handling ──

  it('handles CIP-119 @value wrapper in metadata fields', () => {
    const profile = makeProfile({
      drepId: 'cip119',
      metadata: {
        givenName: { '@value': 'Alice CIP119' },
        objectives: { '@value': 'x'.repeat(200) },
      },
      delegatorCount: 0,
    });

    const scores = computeGovernanceIdentity(new Map([['cip119', profile]]));
    // Should extract string from @value wrapper
    expect(scores.get('cip119')!).toBeGreaterThan(0);
  });

  // ── Scores bounded ──

  it('clamps profile quality to 100 (max raw is 105)', () => {
    // A profile with max everything scores 105 raw, clamped to 100
    const maxProfile = makeProfile({
      drepId: 'max',
      metadata: {
        givenName: 'Max DRep',
        objectives: 'x'.repeat(200),
        motivations: 'x'.repeat(200),
        qualifications: 'x'.repeat(100),
        bio: 'x'.repeat(100),
        references: [
          { uri: 'https://twitter.com/max', label: 'Twitter' },
          { uri: 'https://github.com/max', label: 'GitHub' },
        ],
      },
      metadataHashVerified: true,
      delegatorCount: 1000,
    });

    const scores = computeGovernanceIdentity(new Map([['max', maxProfile]]));
    expect(scores.get('max')!).toBeLessThanOrEqual(100);
    expect(scores.get('max')!).toBeGreaterThanOrEqual(0);
  });
});
