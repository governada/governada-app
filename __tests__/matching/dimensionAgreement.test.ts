import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({}),
  getSupabaseAdmin: () => ({}),
}));

import { computeDimensionAgreement, deriveUserAlignments } from '@/lib/matching/dimensionAgreement';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';

// ── Helpers ──

function makeScores(overrides: Partial<AlignmentScores> = {}): AlignmentScores {
  return {
    treasuryConservative: 50,
    treasuryGrowth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
    ...overrides,
  };
}

// ── computeDimensionAgreement ──

describe('computeDimensionAgreement', () => {
  it('returns 100% agreement for identical scores', () => {
    const scores = makeScores({ treasuryConservative: 80, security: 60 });
    const result = computeDimensionAgreement(scores, scores);

    for (const dim of Object.keys(result.dimensionAgreement) as AlignmentDimension[]) {
      expect(result.dimensionAgreement[dim]).toBe(100);
    }
    expect(result.agreeDimensions.length).toBe(6);
    expect(result.differDimensions.length).toBe(0);
  });

  it('returns 0% agreement for opposite scores (0 vs 100)', () => {
    const user = makeScores({ treasuryConservative: 0 });
    const drep = makeScores({ treasuryConservative: 100 });
    const result = computeDimensionAgreement(user, drep);

    expect(result.dimensionAgreement.treasuryConservative).toBe(0);
    expect(result.differDimensions).toContain('Treasury Conservative');
  });

  it('classifies dimensions ≥70 as "agree"', () => {
    const user = makeScores({ security: 80 });
    const drep = makeScores({ security: 90 });
    const result = computeDimensionAgreement(user, drep);

    // |80-90| = 10, agreement = 90 ≥ 70
    expect(result.dimensionAgreement.security).toBe(90);
    expect(result.agreeDimensions).toContain('Security');
  });

  it('classifies dimensions <40 as "differ"', () => {
    const user = makeScores({ innovation: 10 });
    const drep = makeScores({ innovation: 80 });
    const result = computeDimensionAgreement(user, drep);

    // |10-80| = 70, agreement = 30 < 40
    expect(result.dimensionAgreement.innovation).toBe(30);
    expect(result.differDimensions).toContain('Innovation');
  });

  it('dimensions between 40-69 are neither agree nor differ', () => {
    const user = makeScores({ transparency: 30 });
    const drep = makeScores({ transparency: 70 });
    const result = computeDimensionAgreement(user, drep);

    // |30-70| = 40, agreement = 60 (between 40 and 70)
    expect(result.dimensionAgreement.transparency).toBe(60);
    expect(result.agreeDimensions).not.toContain('Transparency');
    expect(result.differDimensions).not.toContain('Transparency');
  });

  it('uses 50 as default when score is null', () => {
    const user = makeScores({ decentralization: null as unknown as number });
    const drep = makeScores({ decentralization: 50 });
    const result = computeDimensionAgreement(user, drep);

    // null → 50, |50-50| = 0, agreement = 100
    expect(result.dimensionAgreement.decentralization).toBe(100);
  });

  it('handles all null scores gracefully', () => {
    const allNull: AlignmentScores = {
      treasuryConservative: null as unknown as number,
      treasuryGrowth: null as unknown as number,
      decentralization: null as unknown as number,
      security: null as unknown as number,
      innovation: null as unknown as number,
      transparency: null as unknown as number,
    };
    const result = computeDimensionAgreement(allNull, allNull);
    // Both default to 50, so perfect agreement
    for (const dim of Object.keys(result.dimensionAgreement) as AlignmentDimension[]) {
      expect(result.dimensionAgreement[dim]).toBe(100);
    }
  });
});

// ── deriveUserAlignments ──

describe('deriveUserAlignments', () => {
  it('returns null scores when no classifications match', () => {
    const pollVotes = [{ proposal_tx_hash: 'tx1', proposal_index: 0, vote: 'Yes' }];
    const classifications = new Map<string, Record<AlignmentDimension, number>>();

    const result = deriveUserAlignments(pollVotes, classifications);
    expect(result.treasuryConservative).toBeNull();
  });

  it('derives scores from Yes votes (vote value = 1)', () => {
    const pollVotes = [{ proposal_tx_hash: 'tx1', proposal_index: 0, vote: 'Yes' }];
    const classifications = new Map([
      [
        'tx1-0',
        {
          treasuryConservative: 80,
          treasuryGrowth: 20,
          decentralization: 50,
          security: 60,
          innovation: 40,
          transparency: 70,
        },
      ],
    ]);

    const result = deriveUserAlignments(pollVotes, classifications);
    // Yes vote → voteVal=1, score = (1*relevance / relevance)*100 = 100
    expect(result.treasuryConservative).toBe(100);
    expect(result.treasuryGrowth).toBe(100);
  });

  it('derives scores from No votes (vote value = 0)', () => {
    const pollVotes = [{ proposal_tx_hash: 'tx1', proposal_index: 0, vote: 'No' }];
    const classifications = new Map([
      [
        'tx1-0',
        {
          treasuryConservative: 80,
          treasuryGrowth: 20,
          decentralization: 50,
          security: 60,
          innovation: 40,
          transparency: 70,
        },
      ],
    ]);

    const result = deriveUserAlignments(pollVotes, classifications);
    // No vote → voteVal=0, score = (0*relevance / relevance)*100 = 0
    expect(result.treasuryConservative).toBe(0);
  });

  it('derives scores from Abstain votes (vote value = 0.5)', () => {
    const pollVotes = [{ proposal_tx_hash: 'tx1', proposal_index: 0, vote: 'Abstain' }];
    const classifications = new Map([
      [
        'tx1-0',
        {
          treasuryConservative: 80,
          treasuryGrowth: 20,
          decentralization: 50,
          security: 60,
          innovation: 40,
          transparency: 70,
        },
      ],
    ]);

    const result = deriveUserAlignments(pollVotes, classifications);
    // Abstain → voteVal=0.5, score = (0.5*relevance / relevance)*100 = 50
    expect(result.treasuryConservative).toBe(50);
  });

  it('weights by proposal relevance across multiple votes', () => {
    const pollVotes = [
      { proposal_tx_hash: 'tx1', proposal_index: 0, vote: 'Yes' },
      { proposal_tx_hash: 'tx2', proposal_index: 0, vote: 'No' },
    ];
    const classifications = new Map([
      [
        'tx1-0',
        {
          treasuryConservative: 80,
          treasuryGrowth: 0,
          decentralization: 0,
          security: 0,
          innovation: 0,
          transparency: 0,
        },
      ],
      [
        'tx2-0',
        {
          treasuryConservative: 20,
          treasuryGrowth: 0,
          decentralization: 0,
          security: 0,
          innovation: 0,
          transparency: 0,
        },
      ],
    ]);

    const result = deriveUserAlignments(pollVotes, classifications);
    // tx1: Yes (voteVal=1) × relevance=80 → contribution=80, weight=80
    // tx2: No (voteVal=0) × relevance=20 → contribution=0, weight=20
    // score = ((80 + 0) / (80 + 20)) * 100 = 80
    expect(result.treasuryConservative).toBe(80);
  });

  it('skips dimensions with 0 relevance', () => {
    const pollVotes = [{ proposal_tx_hash: 'tx1', proposal_index: 0, vote: 'Yes' }];
    const classifications = new Map([
      [
        'tx1-0',
        {
          treasuryConservative: 80,
          treasuryGrowth: 0, // zero relevance
          decentralization: 50,
          security: 0,
          innovation: 0,
          transparency: 0,
        },
      ],
    ]);

    const result = deriveUserAlignments(pollVotes, classifications);
    // Zero relevance → no contribution → null
    expect(result.treasuryGrowth).toBeNull();
    expect(result.security).toBeNull();
  });

  it('handles empty poll votes', () => {
    const result = deriveUserAlignments([], new Map());
    expect(result.treasuryConservative).toBeNull();
    expect(result.transparency).toBeNull();
  });
});
