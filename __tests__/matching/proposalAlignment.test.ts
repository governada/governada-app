import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({}),
  getSupabaseAdmin: () => ({}),
}));

import {
  predictUserStance,
  computeProposalAlignment,
  getProposalAlignmentReason,
  type VoteWithClassification,
} from '@/lib/matching/proposalAlignment';
import type { AlignmentScores } from '@/lib/drepIdentity';

/* ─── Helpers ─────────────────────────────────────────── */

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

function makeVote(overrides: Partial<VoteWithClassification> = {}): VoteWithClassification {
  return {
    proposalId: 'tx123#0',
    proposalTitle: 'Test Proposal',
    proposalType: 'TreasuryWithdrawals',
    vote: 'Yes',
    epochNo: 500,
    classification: {
      dimTreasuryConservative: 0.8,
      dimTreasuryGrowth: 0.2,
      dimDecentralization: 0.1,
      dimSecurity: 0.1,
      dimInnovation: 0.1,
      dimTransparency: 0.1,
    },
    ...overrides,
  };
}

/* ─── predictUserStance ───────────────────────────────── */

describe('predictUserStance', () => {
  it('predicts Yes for high user score (>65)', () => {
    const result = predictUserStance(80, 0.8);
    expect(result.stance).toBe('Yes');
    expect(result.confidence).toBe(60); // |80-50|*2
  });

  it('predicts No for low user score (<35)', () => {
    const result = predictUserStance(20, 0.8);
    expect(result.stance).toBe('No');
    expect(result.confidence).toBe(60); // |20-50|*2
  });

  it('predicts Neutral for middle user score (35-65)', () => {
    const result = predictUserStance(50, 0.8);
    expect(result.stance).toBe('Neutral');
    expect(result.confidence).toBe(0); // |50-50|*2
  });

  it('returns Neutral with 0 confidence when user is exactly 50', () => {
    const result = predictUserStance(50, 0.8);
    expect(result.stance).toBe('Neutral');
    expect(result.confidence).toBe(0);
  });

  it('returns max confidence of 100 for extreme user score (100)', () => {
    const result = predictUserStance(100, 0.8);
    expect(result.stance).toBe('Yes');
    expect(result.confidence).toBe(100);
  });

  it('returns max confidence of 100 for extreme user score (0)', () => {
    const result = predictUserStance(0, 0.8);
    expect(result.stance).toBe('No');
    expect(result.confidence).toBe(100);
  });

  it('returns Neutral for classification below 0.6', () => {
    const result = predictUserStance(90, 0.5);
    expect(result.stance).toBe('Neutral');
    expect(result.confidence).toBe(0);
  });

  it('defaults null user score to 50 (Neutral)', () => {
    const result = predictUserStance(null, 0.8);
    expect(result.stance).toBe('Neutral');
    expect(result.confidence).toBe(0);
  });
});

/* ─── computeProposalAlignment ────────────────────────── */

describe('computeProposalAlignment', () => {
  it('returns null for empty votes array', () => {
    const result = computeProposalAlignment(makeScores(), []);
    expect(result).toBeNull();
  });

  it('returns null when no proposals have qualifying classification', () => {
    const vote = makeVote({
      classification: {
        dimTreasuryConservative: 0.3,
        dimTreasuryGrowth: 0.2,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });
    const result = computeProposalAlignment(makeScores(), [vote]);
    expect(result).toBeNull();
  });

  it('produces agreement when user and DRep align on dimension', () => {
    const userScores = makeScores({ treasuryConservative: 90 });
    const vote = makeVote({
      vote: 'Yes',
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [vote]);
    expect(result).not.toBeNull();
    expect(result!.topAgreements.length).toBe(1);
    expect(result!.topAgreements[0].agreement).toBe('agree');
  });

  it('produces disagreement when user and DRep oppose on dimension', () => {
    const userScores = makeScores({ treasuryConservative: 90 });
    const vote = makeVote({
      vote: 'No',
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [vote]);
    expect(result).not.toBeNull();
    expect(result!.topDisagreements.length).toBe(1);
    expect(result!.topDisagreements[0].agreement).toBe('disagree');
  });

  it('produces neutral for Abstain votes regardless of user stance', () => {
    const userScores = makeScores({ treasuryConservative: 90 });
    const vote = makeVote({
      vote: 'Abstain',
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [vote]);
    expect(result).not.toBeNull();
    expect(result!.topAgreements.length).toBe(0);
    expect(result!.topDisagreements.length).toBe(0);
  });

  it('produces all Neutral stances when user alignment is all 50', () => {
    const userScores = makeScores();
    const votes = [
      makeVote({ proposalId: 'tx1#0', vote: 'Yes', epochNo: 500 }),
      makeVote({ proposalId: 'tx2#0', vote: 'No', epochNo: 499 }),
    ];

    const result = computeProposalAlignment(userScores, votes);
    expect(result).not.toBeNull();
    expect(result!.topAgreements.length).toBe(0);
    expect(result!.topDisagreements.length).toBe(0);
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
  });

  it('caps top agreements at 3 and top disagreements at 2', () => {
    const userScores = makeScores({ treasuryConservative: 90 });

    const agreements = Array.from({ length: 5 }, (_, i) =>
      makeVote({
        proposalId: `tx-agree-${i}#0`,
        vote: 'Yes',
        epochNo: 500 - i,
        classification: {
          dimTreasuryConservative: 0.9,
          dimTreasuryGrowth: 0.1,
          dimDecentralization: 0.1,
          dimSecurity: 0.1,
          dimInnovation: 0.1,
          dimTransparency: 0.1,
        },
      }),
    );

    const disagreements = Array.from({ length: 4 }, (_, i) =>
      makeVote({
        proposalId: `tx-disagree-${i}#0`,
        vote: 'No',
        epochNo: 500 - i,
        classification: {
          dimTreasuryConservative: 0.9,
          dimTreasuryGrowth: 0.1,
          dimDecentralization: 0.1,
          dimSecurity: 0.1,
          dimInnovation: 0.1,
          dimTransparency: 0.1,
        },
      }),
    );

    const result = computeProposalAlignment(userScores, [...agreements, ...disagreements]);

    expect(result).not.toBeNull();
    expect(result!.topAgreements.length).toBe(3);
    expect(result!.topDisagreements.length).toBe(2);
  });

  it('returns fewer than max when not enough results', () => {
    const userScores = makeScores({ treasuryConservative: 90 });
    const vote = makeVote({
      vote: 'Yes',
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [vote]);
    expect(result).not.toBeNull();
    expect(result!.topAgreements.length).toBe(1);
    expect(result!.topDisagreements.length).toBe(0);
  });

  it('favors recent proposals via recency weighting', () => {
    const userScores = makeScores({ treasuryConservative: 90 });

    const recentVote = makeVote({
      proposalId: 'tx-recent#0',
      vote: 'Yes',
      epochNo: 500,
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const oldVote = makeVote({
      proposalId: 'tx-old#0',
      vote: 'Yes',
      epochNo: 400,
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [oldVote, recentVote], {
      maxAgreements: 1,
    });

    expect(result).not.toBeNull();
    expect(result!.topAgreements[0].proposalId).toBe('tx-recent#0');
  });

  it('excludes proposals with classification below 0.6', () => {
    const userScores = makeScores({ treasuryConservative: 90 });
    const lowClassVote = makeVote({
      classification: {
        dimTreasuryConservative: 0.5,
        dimTreasuryGrowth: 0.2,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [lowClassVote]);
    expect(result).toBeNull();
  });

  it('generates a narrative string', () => {
    const userScores = makeScores({ treasuryConservative: 90 });
    const vote = makeVote({
      vote: 'Yes',
      classification: {
        dimTreasuryConservative: 0.9,
        dimTreasuryGrowth: 0.1,
        dimDecentralization: 0.1,
        dimSecurity: 0.1,
        dimInnovation: 0.1,
        dimTransparency: 0.1,
      },
    });

    const result = computeProposalAlignment(userScores, [vote]);
    expect(result).not.toBeNull();
    expect(typeof result!.narrative).toBe('string');
    expect(result!.narrative.length).toBeGreaterThan(0);
  });

  it('handles division safely with no agreements or disagreements', () => {
    // All votes are Abstain -> all neutral
    const userScores = makeScores({ treasuryConservative: 90 });
    const votes = [
      makeVote({ proposalId: 'tx1#0', vote: 'Abstain', epochNo: 500 }),
      makeVote({ proposalId: 'tx2#0', vote: 'Abstain', epochNo: 499 }),
    ];

    const result = computeProposalAlignment(userScores, votes);
    expect(result).not.toBeNull();
    expect(result!.overallAlignment).not.toBeNaN();
    expect(result!.topAgreements.length).toBe(0);
    expect(result!.topDisagreements.length).toBe(0);
  });
});

/* ─── getProposalAlignmentReason ──────────────────────── */

describe('getProposalAlignmentReason', () => {
  it('returns agree reason for known dimension', () => {
    const reason = getProposalAlignmentReason('Treasury Conservative', 'agree');
    expect(reason).toContain('fiscal conservatism');
  });

  it('returns disagree reason for known dimension', () => {
    const reason = getProposalAlignmentReason('Innovation', 'disagree');
    expect(reason).toContain('innovation');
  });

  it('returns fallback reason for unknown dimension', () => {
    const reason = getProposalAlignmentReason('Unknown Dimension', 'agree');
    expect(reason).toContain('Aligned');
  });
});
