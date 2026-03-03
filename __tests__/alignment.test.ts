import { describe, it, expect } from 'vitest';
import {
  classifyProposal,
  classifyProposals,
  getProposalsForPref,
  matchVotesToProposals,
  calculateTreasuryConservativeScore,
  calculateTreasuryGrowthScore,
  calculateDecentralizationScore,
  calculateSecurityScore,
  calculateInnovationScore,
  calculateTransparencyScore,
  calculateScorecard,
  detectAlignmentShifts,
  evaluateVoteAlignment,
  isTreasuryVote,
  calculateAlignment,
  getPrefLabel,
  getAlignmentColor,
  computeAllCategoryScores,
  computeOverallAlignment,
  getPrecomputedBreakdown,
} from '@/lib/alignment';
import type { ProposalInfo, DRepVote, ClassifiedProposal } from '@/types/koios';
import type { UserPrefKey } from '@/types/drep';
import type { EnrichedDRep } from '@/lib/koios';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProposal(overrides: Partial<ProposalInfo> = {}): ProposalInfo {
  return {
    proposal_tx_hash: 'ptx_' + Math.random().toString(36).slice(2, 10),
    proposal_index: 0,
    proposal_id: 'gov_action1abc',
    proposal_type: 'TreasuryWithdrawals',
    proposal_description: null,
    deposit: '500000000',
    return_address: 'addr1...',
    proposed_epoch: 100,
    ratified_epoch: null,
    enacted_epoch: null,
    dropped_epoch: null,
    expired_epoch: null,
    expiration: null,
    meta_url: null,
    meta_hash: null,
    meta_json: null,
    meta_comment: null,
    meta_is_valid: null,
    withdrawal: null,
    param_proposal: null,
    block_time: 1700000000,
    ...overrides,
  };
}

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

function makeEnrichedDRep(overrides: Partial<EnrichedDRep> = {}): EnrichedDRep {
  return {
    drepId: 'drep1_test',
    drepHash: 'hash_test',
    handle: null,
    name: 'Test DRep',
    ticker: null,
    description: null,
    votingPower: 500_000,
    votingPowerLovelace: '500000000000',
    participationRate: 70,
    rationaleRate: 60,
    reliabilityScore: 80,
    reliabilityStreak: 5,
    reliabilityRecency: 0,
    reliabilityLongestGap: 2,
    reliabilityTenure: 20,
    deliberationModifier: 1.0,
    effectiveParticipation: 70,
    sizeTier: 'Medium',
    delegatorCount: 50,
    totalVotes: 20,
    yesVotes: 12,
    noVotes: 5,
    abstainVotes: 3,
    isActive: true,
    anchorUrl: null,
    anchorHash: null,
    metadata: null,
    profileCompleteness: 60,
    lastVoteTime: null,
    metadataHashVerified: null,
    updatedAt: null,
    drepScore: 72,
    alignmentTreasuryConservative: null,
    alignmentTreasuryGrowth: null,
    alignmentDecentralization: null,
    alignmentSecurity: null,
    alignmentInnovation: null,
    alignmentTransparency: null,
    ...overrides,
  };
}

function makeClassifiedProposal(overrides: Partial<ClassifiedProposal> = {}): ClassifiedProposal {
  return {
    txHash: 'ptx_test',
    index: 0,
    proposalId: 'gov_action1abc',
    type: 'TreasuryWithdrawals',
    title: 'Test Proposal',
    abstract: null,
    withdrawalAmountAda: 500_000,
    treasuryTier: 'routine',
    paramChanges: null,
    relevantPrefs: ['treasury-conservative', 'smart-treasury-growth'],
    proposedEpoch: 100,
    blockTime: 1700000000,
    ratifiedEpoch: null,
    enactedEpoch: null,
    droppedEpoch: null,
    expiredEpoch: null,
    expirationEpoch: null,
    ...overrides,
  };
}

// ── classifyProposal ─────────────────────────────────────────────────────────

describe('classifyProposal', () => {
  it('classifies TreasuryWithdrawals with correct prefs', () => {
    const proposal = makeProposal({
      proposal_type: 'TreasuryWithdrawals',
      withdrawal: [{ stake_address: 'stake1...', amount: '500000000000' }],
    });
    const classified = classifyProposal(proposal);
    expect(classified.relevantPrefs).toContain('treasury-conservative');
    expect(classified.relevantPrefs).toContain('smart-treasury-growth');
    expect(classified.withdrawalAmountAda).toBe(500_000);
    expect(classified.treasuryTier).toBe('routine');
  });

  it('classifies major treasury withdrawal (>20M)', () => {
    const proposal = makeProposal({
      proposal_type: 'TreasuryWithdrawals',
      withdrawal: [{ stake_address: 'stake1...', amount: '25000000000000' }],
    });
    const classified = classifyProposal(proposal);
    expect(classified.treasuryTier).toBe('major');
  });

  it('classifies significant treasury withdrawal (1M-20M)', () => {
    const proposal = makeProposal({
      proposal_type: 'TreasuryWithdrawals',
      withdrawal: [{ stake_address: 'stake1...', amount: '5000000000000' }],
    });
    const classified = classifyProposal(proposal);
    expect(classified.treasuryTier).toBe('significant');
  });

  it('classifies ParameterChange', () => {
    const proposal = makeProposal({ proposal_type: 'ParameterChange' });
    const classified = classifyProposal(proposal);
    expect(classified.relevantPrefs).toContain('protocol-security-first');
  });

  it('classifies HardForkInitiation', () => {
    const proposal = makeProposal({ proposal_type: 'HardForkInitiation' });
    const classified = classifyProposal(proposal);
    expect(classified.relevantPrefs).toContain('protocol-security-first');
    expect(classified.relevantPrefs).toContain('innovation-defi-growth');
  });

  it('classifies NoConfidence', () => {
    const proposal = makeProposal({ proposal_type: 'NoConfidence' });
    const classified = classifyProposal(proposal);
    expect(classified.relevantPrefs).toContain('strong-decentralization');
    expect(classified.relevantPrefs).toContain('protocol-security-first');
  });

  it('classifies InfoAction with keyword analysis', () => {
    const proposal = makeProposal({
      proposal_type: 'InfoAction',
      meta_json: {
        body: { title: 'DeFi Innovation Grant', abstract: 'Fund growth in DeFi ecosystem' },
      },
    });
    const classified = classifyProposal(proposal);
    expect(classified.relevantPrefs).toContain('innovation-defi-growth');
  });

  it('defaults InfoAction to responsible-governance when no keywords match', () => {
    const proposal = makeProposal({
      proposal_type: 'InfoAction',
      meta_json: { body: { title: 'General info', abstract: 'Some text' } },
    });
    const classified = classifyProposal(proposal);
    expect(classified.relevantPrefs).toContain('responsible-governance');
  });

  it('handles proposal with no withdrawal array', () => {
    const proposal = makeProposal({
      proposal_type: 'TreasuryWithdrawals',
      withdrawal: null,
    });
    const classified = classifyProposal(proposal);
    expect(classified.withdrawalAmountAda).toBeNull();
    expect(classified.treasuryTier).toBeNull();
  });

  it('extracts title from meta_json.body.title', () => {
    const proposal = makeProposal({
      meta_json: { body: { title: 'My Proposal Title' } },
    });
    const classified = classifyProposal(proposal);
    expect(classified.title).toBe('My Proposal Title');
  });
});

// ── classifyProposals ────────────────────────────────────────────────────────

describe('classifyProposals', () => {
  it('classifies an array of proposals', () => {
    const proposals = [
      makeProposal({ proposal_type: 'TreasuryWithdrawals' }),
      makeProposal({ proposal_type: 'ParameterChange' }),
    ];
    const classified = classifyProposals(proposals);
    expect(classified.length).toBe(2);
    expect(classified[0].type).toBe('TreasuryWithdrawals');
    expect(classified[1].type).toBe('ParameterChange');
  });
});

// ── getProposalsForPref ──────────────────────────────────────────────────────

describe('getProposalsForPref', () => {
  it('filters proposals by preference', () => {
    const proposals = [
      makeClassifiedProposal({ relevantPrefs: ['treasury-conservative'] }),
      makeClassifiedProposal({ relevantPrefs: ['protocol-security-first'] }),
    ];
    const result = getProposalsForPref(proposals, 'treasury-conservative');
    expect(result.length).toBe(1);
  });
});

// ── matchVotesToProposals ────────────────────────────────────────────────────

describe('matchVotesToProposals', () => {
  it('matches votes to proposals by tx_hash and index', () => {
    const proposals = [makeClassifiedProposal({ txHash: 'tx1', index: 0 })];
    const votes = [
      makeVote({ proposal_tx_hash: 'tx1', proposal_index: 0 }),
      makeVote({ proposal_tx_hash: 'tx_unknown', proposal_index: 0 }),
    ];
    const result = matchVotesToProposals(votes, proposals);
    expect(result[0].proposal?.txHash).toBe('tx1');
    expect(result[1].proposal).toBeNull();
  });
});

// ── calculateTreasuryConservativeScore ────────────────────────────────────────

describe('calculateTreasuryConservativeScore', () => {
  it('returns 50 (neutral) when no treasury votes', () => {
    expect(calculateTreasuryConservativeScore([])).toBe(50);
  });

  it('scores 100 for No on major withdrawal', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'No' }),
        proposal: makeClassifiedProposal({ type: 'TreasuryWithdrawals', treasuryTier: 'major' }),
      },
    ];
    expect(calculateTreasuryConservativeScore(votesWithProposals)).toBe(100);
  });

  it('scores 10 for Yes on major withdrawal', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'Yes' }),
        proposal: makeClassifiedProposal({ type: 'TreasuryWithdrawals', treasuryTier: 'major' }),
      },
    ];
    expect(calculateTreasuryConservativeScore(votesWithProposals)).toBe(10);
  });

  it('scores 50 for Abstain (neutral)', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'Abstain' }),
        proposal: makeClassifiedProposal({ type: 'TreasuryWithdrawals', treasuryTier: 'routine' }),
      },
    ];
    expect(calculateTreasuryConservativeScore(votesWithProposals)).toBe(50);
  });
});

// ── calculateTreasuryGrowthScore ─────────────────────────────────────────────

describe('calculateTreasuryGrowthScore', () => {
  it('returns 50 (neutral) when no treasury votes', () => {
    expect(calculateTreasuryGrowthScore([])).toBe(50);
  });

  it('rewards Yes with rationale on major withdrawal', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'Yes', meta_url: 'https://rationale.com' }),
        proposal: makeClassifiedProposal({ type: 'TreasuryWithdrawals', treasuryTier: 'major' }),
      },
    ];
    expect(calculateTreasuryGrowthScore(votesWithProposals)).toBe(90);
  });

  it('penalizes No without rationale', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'No' }),
        proposal: makeClassifiedProposal({ type: 'TreasuryWithdrawals' }),
      },
    ];
    expect(calculateTreasuryGrowthScore(votesWithProposals)).toBe(20);
  });
});

// ── calculateDecentralizationScore ───────────────────────────────────────────

describe('calculateDecentralizationScore', () => {
  it('scores highest for Small tier', () => {
    expect(calculateDecentralizationScore(makeEnrichedDRep({ sizeTier: 'Small' }))).toBe(95);
  });

  it('scores medium for Medium tier', () => {
    expect(calculateDecentralizationScore(makeEnrichedDRep({ sizeTier: 'Medium' }))).toBe(72);
  });

  it('scores low for Whale tier', () => {
    expect(calculateDecentralizationScore(makeEnrichedDRep({ sizeTier: 'Whale' }))).toBe(12);
  });

  it('defaults to 50 for unknown tier', () => {
    expect(calculateDecentralizationScore(makeEnrichedDRep({ sizeTier: 'Unknown' as any }))).toBe(
      50,
    );
  });
});

// ── calculateSecurityScore ───────────────────────────────────────────────────

describe('calculateSecurityScore', () => {
  it('falls back to participation/rationale mix with no security votes', () => {
    const drep = makeEnrichedDRep({ participationRate: 80, rationaleRate: 60 });
    const score = calculateSecurityScore(drep, []);
    expect(score).toBe(Math.round(80 * 0.6 + 60 * 0.4));
  });

  it('rewards cautious voting on security proposals', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'No', meta_url: 'https://r.com' }),
        proposal: makeClassifiedProposal({ relevantPrefs: ['protocol-security-first'] }),
      },
    ];
    const score = calculateSecurityScore(makeEnrichedDRep(), votesWithProposals);
    expect(score).toBeGreaterThan(50);
  });
});

// ── calculateInnovationScore ─────────────────────────────────────────────────

describe('calculateInnovationScore', () => {
  it('falls back to participation + 25 with no innovation votes', () => {
    const drep = makeEnrichedDRep({ participationRate: 80 });
    const score = calculateInnovationScore(drep, []);
    expect(score).toBe(Math.round(80 * 0.5 + 25));
  });

  it('rewards Yes votes on innovation proposals', () => {
    const votesWithProposals = [
      {
        vote: makeVote({ vote: 'Yes' }),
        proposal: makeClassifiedProposal({ relevantPrefs: ['innovation-defi-growth'] }),
      },
    ];
    const drep = makeEnrichedDRep({ participationRate: 100 });
    const score = calculateInnovationScore(drep, votesWithProposals);
    expect(score).toBe(Math.round(100 * 0.5 + 100 * 0.5));
  });
});

// ── calculateTransparencyScore ───────────────────────────────────────────────

describe('calculateTransparencyScore', () => {
  it('directly maps rationale rate', () => {
    expect(calculateTransparencyScore(makeEnrichedDRep({ rationaleRate: 75 }))).toBe(75);
    expect(calculateTransparencyScore(makeEnrichedDRep({ rationaleRate: 0 }))).toBe(0);
  });
});

// ── calculateScorecard ───────────────────────────────────────────────────────

describe('calculateScorecard', () => {
  it('returns neutral (50) scores when no prefs selected', () => {
    const scorecard = calculateScorecard(makeEnrichedDRep(), [], [], []);
    expect(scorecard.scores.overall).toBe(50);
    expect(scorecard.scores.treasury).toBe(50);
  });

  it('calculates overall as average of active category scores', () => {
    const drep = makeEnrichedDRep({ sizeTier: 'Small', rationaleRate: 80 });
    const scorecard = calculateScorecard(
      drep,
      [],
      [],
      ['strong-decentralization', 'responsible-governance'],
    );
    expect(scorecard.scores.decentralization).toBe(95);
    expect(scorecard.scores.transparency).toBe(80);
    expect(scorecard.scores.overall).toBe(Math.round((95 + 80) / 2));
  });
});

// ── detectAlignmentShifts ────────────────────────────────────────────────────

describe('detectAlignmentShifts', () => {
  it('returns null when no previous scorecard', () => {
    const current = {
      drepId: 'drep1',
      scores: {
        treasury: 50,
        decentralization: 50,
        security: 50,
        innovation: 50,
        transparency: 50,
        overall: 50,
      },
      votesAnalyzed: 10,
      calculatedAt: Date.now(),
    };
    expect(detectAlignmentShifts(null, current, 'Test', [])).toBeNull();
  });

  it('returns null when delta is above threshold', () => {
    const prev = {
      drepId: 'drep1',
      scores: {
        treasury: 50,
        decentralization: 50,
        security: 50,
        innovation: 50,
        transparency: 50,
        overall: 50,
      },
      votesAnalyzed: 10,
      calculatedAt: Date.now(),
    };
    const current = { ...prev, scores: { ...prev.scores, overall: 45 } };
    expect(detectAlignmentShifts(prev, current, 'Test', [])).toBeNull();
  });

  it('detects significant shift (delta < -8)', () => {
    const prev = {
      drepId: 'drep1',
      scores: {
        treasury: 80,
        decentralization: 70,
        security: 60,
        innovation: 50,
        transparency: 50,
        overall: 70,
      },
      votesAnalyzed: 10,
      calculatedAt: Date.now(),
    };
    const current = {
      ...prev,
      scores: { ...prev.scores, treasury: 40, overall: 50 },
    };
    const shift = detectAlignmentShifts(prev, current, 'Test', ['treasury-conservative']);
    expect(shift).not.toBeNull();
    expect(shift!.delta).toBe(-20);
    expect(shift!.categoryShifts.length).toBeGreaterThan(0);
  });
});

// ── evaluateVoteAlignment ────────────────────────────────────────────────────

describe('evaluateVoteAlignment', () => {
  it('returns neutral for empty user prefs', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      true,
      'TreasuryWithdrawals',
      null,
      ['treasury-conservative'],
      [],
    );
    expect(result.status).toBe('neutral');
  });

  it('returns neutral when no matching prefs', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      true,
      'TreasuryWithdrawals',
      null,
      ['treasury-conservative'],
      ['innovation-defi-growth'],
    );
    expect(result.status).toBe('neutral');
  });

  it('evaluates treasury-conservative: No = aligned', () => {
    const result = evaluateVoteAlignment(
      'No',
      true,
      'TreasuryWithdrawals',
      null,
      ['treasury-conservative'],
      ['treasury-conservative'],
    );
    expect(result.status).toBe('aligned');
    expect(result.reasons).toContain('Voted No on treasury spend');
  });

  it('evaluates treasury-conservative: Yes = unaligned', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      true,
      'TreasuryWithdrawals',
      null,
      ['treasury-conservative'],
      ['treasury-conservative'],
    );
    expect(result.status).toBe('unaligned');
  });

  it('evaluates smart-treasury-growth: Yes + rationale = aligned', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      true,
      'TreasuryWithdrawals',
      null,
      ['smart-treasury-growth'],
      ['smart-treasury-growth'],
    );
    expect(result.status).toBe('aligned');
  });

  it('evaluates smart-treasury-growth: Yes without rationale = unaligned', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      false,
      'TreasuryWithdrawals',
      null,
      ['smart-treasury-growth'],
      ['smart-treasury-growth'],
    );
    expect(result.status).toBe('unaligned');
  });

  it('evaluates protocol-security-first: No/Abstain = cautious = aligned', () => {
    const result = evaluateVoteAlignment(
      'No',
      false,
      'ParameterChange',
      null,
      ['protocol-security-first'],
      ['protocol-security-first'],
    );
    expect(result.status).toBe('aligned');
  });

  it('evaluates innovation-defi-growth: Yes = aligned', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      false,
      'HardForkInitiation',
      null,
      ['innovation-defi-growth'],
      ['innovation-defi-growth'],
    );
    expect(result.status).toBe('aligned');
  });

  it('evaluates responsible-governance: has rationale = aligned', () => {
    const result = evaluateVoteAlignment(
      'Yes',
      true,
      null,
      null,
      ['responsible-governance'],
      ['responsible-governance'],
    );
    expect(result.status).toBe('aligned');
  });
});

// ── isTreasuryVote ───────────────────────────────────────────────────────────

describe('isTreasuryVote', () => {
  it('detects treasury keywords in meta_json', () => {
    const vote = makeVote({
      meta_json: { title: 'Treasury Withdrawal Proposal' },
    });
    expect(isTreasuryVote(vote)).toBe(true);
  });

  it('returns false for non-treasury vote', () => {
    const vote = makeVote({
      meta_json: { title: 'Parameter Update' },
    });
    expect(isTreasuryVote(vote)).toBe(false);
  });

  it('handles null meta_json', () => {
    expect(isTreasuryVote(makeVote())).toBe(false);
  });
});

// ── calculateAlignment (legacy) ──────────────────────────────────────────────

describe('calculateAlignment', () => {
  it('returns 50 for empty prefs', () => {
    expect(calculateAlignment(makeEnrichedDRep(), [], [])).toBe(50);
  });
});

// ── getPrefLabel ─────────────────────────────────────────────────────────────

describe('getPrefLabel', () => {
  it('returns human-readable labels', () => {
    expect(getPrefLabel('treasury-conservative')).toBe('Treasury Conservative');
    expect(getPrefLabel('responsible-governance')).toBe('Transparency & Accountability');
  });
});

// ── getAlignmentColor ────────────────────────────────────────────────────────

describe('getAlignmentColor', () => {
  it('returns green for >= 70', () => {
    expect(getAlignmentColor(70)).toContain('green');
  });

  it('returns amber for 50-69', () => {
    expect(getAlignmentColor(50)).toContain('amber');
  });

  it('returns slate for < 50', () => {
    expect(getAlignmentColor(30)).toContain('slate');
  });
});

// ── computeAllCategoryScores ─────────────────────────────────────────────────

describe('computeAllCategoryScores', () => {
  it('computes all 6 category scores', () => {
    const drep = makeEnrichedDRep({ sizeTier: 'Small', rationaleRate: 80, participationRate: 70 });
    const scores = computeAllCategoryScores(drep, [], []);
    expect(scores.alignmentDecentralization).toBe(95);
    expect(scores.alignmentTransparency).toBe(80);
    expect(scores.alignmentTreasuryConservative).toBe(50);
    expect(scores.alignmentTreasuryGrowth).toBe(50);
    expect(scores.lastVoteTime).toBeNull();
  });

  it('extracts lastVoteTime from votes', () => {
    const votes = [
      makeVote({ block_time: 1000 }),
      makeVote({ block_time: 5000 }),
      makeVote({ block_time: 3000 }),
    ];
    const scores = computeAllCategoryScores(makeEnrichedDRep(), votes, []);
    expect(scores.lastVoteTime).toBe(5000);
  });
});

// ── computeOverallAlignment ──────────────────────────────────────────────────

describe('computeOverallAlignment', () => {
  it('returns 50 for empty prefs', () => {
    expect(computeOverallAlignment(makeEnrichedDRep(), [])).toBe(50);
  });

  it('averages active precomputed scores', () => {
    const drep = makeEnrichedDRep({
      alignmentDecentralization: 90,
      alignmentTransparency: 70,
    });
    const result = computeOverallAlignment(drep, [
      'strong-decentralization',
      'responsible-governance',
    ]);
    expect(result).toBe(80);
  });

  it('ignores null precomputed scores', () => {
    const drep = makeEnrichedDRep({
      alignmentDecentralization: 90,
      alignmentSecurity: null,
    });
    const result = computeOverallAlignment(drep, [
      'strong-decentralization',
      'protocol-security-first',
    ]);
    expect(result).toBe(90);
  });

  it('returns 50 when all relevant scores are null', () => {
    const drep = makeEnrichedDRep();
    const result = computeOverallAlignment(drep, ['strong-decentralization']);
    expect(result).toBe(50);
  });
});

// ── getPrecomputedBreakdown ──────────────────────────────────────────────────

describe('getPrecomputedBreakdown', () => {
  it('uses treasury-conservative score when pref selected', () => {
    const drep = makeEnrichedDRep({
      alignmentTreasuryConservative: 80,
      alignmentTreasuryGrowth: 60,
    });
    const breakdown = getPrecomputedBreakdown(drep, ['treasury-conservative']);
    expect(breakdown.treasury).toBe(80);
  });

  it('uses treasury-growth score when pref selected', () => {
    const drep = makeEnrichedDRep({
      alignmentTreasuryConservative: 80,
      alignmentTreasuryGrowth: 60,
    });
    const breakdown = getPrecomputedBreakdown(drep, ['smart-treasury-growth']);
    expect(breakdown.treasury).toBe(60);
  });

  it('defaults to 50 for missing precomputed values', () => {
    const drep = makeEnrichedDRep();
    const breakdown = getPrecomputedBreakdown(drep, []);
    expect(breakdown.treasury).toBe(50);
    expect(breakdown.overall).toBe(50);
  });
});
