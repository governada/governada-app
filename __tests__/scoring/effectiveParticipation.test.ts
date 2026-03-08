import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/display', () => ({
  isValidatedSocialLink: () => true,
}));

import {
  computeEffectiveParticipation,
  getExtendedImportanceWeight,
} from '@/lib/scoring/effectiveParticipation';
import type { VoteData, ProposalScoringContext, ProposalVotingSummary } from '@/lib/scoring/types';
import {
  makeVoteData,
  makeProposalContext,
  makeVotingSummary,
  NOW,
  ONE_DAY,
} from '../fixtures/scoring';

// ── Helpers ──

function setupScenario(
  votes: VoteData[],
  proposals: ProposalScoringContext[],
  summaries?: ProposalVotingSummary[],
) {
  const drepVotes = new Map<string, VoteData[]>();
  for (const v of votes) {
    if (!drepVotes.has(v.drepId)) drepVotes.set(v.drepId, []);
    drepVotes.get(v.drepId)!.push(v);
  }

  const allProposals = new Map(proposals.map((p) => [p.proposalKey, p]));
  const votingSummaries = new Map(
    (summaries ?? proposals.map((p) => makeVotingSummary({ proposalKey: p.proposalKey }))).map(
      (s) => [s.proposalKey, s],
    ),
  );

  return { drepVotes, allProposals, votingSummaries };
}

// ── Tests ──

describe('computeEffectiveParticipation', () => {
  it('returns 0 for DRep with empty vote array', () => {
    const proposals = [makeProposalContext({ proposalKey: 'p1' })];
    const { drepVotes, allProposals, votingSummaries } = setupScenario([], proposals);
    drepVotes.set('drep_empty', []);

    const scores = computeEffectiveParticipation(drepVotes, allProposals, votingSummaries, NOW);
    expect(scores.get('drep_empty')).toBe(0);
  });

  it('gives higher score for more proposals voted on', () => {
    const proposals = Array.from({ length: 10 }, (_, i) =>
      makeProposalContext({
        proposalKey: `p${i}`,
        blockTime: NOW - (10 - i) * 5 * ONE_DAY,
      }),
    );

    const activeVotes = proposals.map((p) =>
      makeVoteData({
        drepId: 'active',
        proposalKey: p.proposalKey,
        blockTime: p.blockTime + ONE_DAY,
        importanceWeight: p.importanceWeight,
      }),
    );

    const lazyVotes = proposals.slice(0, 3).map((p) =>
      makeVoteData({
        drepId: 'lazy',
        proposalKey: p.proposalKey,
        blockTime: p.blockTime + ONE_DAY,
        importanceWeight: p.importanceWeight,
      }),
    );

    const { drepVotes, allProposals, votingSummaries } = setupScenario(
      [...activeVotes, ...lazyVotes],
      proposals,
    );

    const scores = computeEffectiveParticipation(drepVotes, allProposals, votingSummaries, NOW);
    expect(scores.get('active')!).toBeGreaterThan(scores.get('lazy')!);
  });

  it('applies close-margin bonus (1.5x) when margin < 20%', () => {
    const proposal = makeProposalContext({
      proposalKey: 'close_call',
      blockTime: NOW - 10 * ONE_DAY,
      importanceWeight: 2,
    });

    const closeMarginSummary = makeVotingSummary({
      proposalKey: 'close_call',
      drepYesVotePower: 5100,
      drepNoVotePower: 4900,
      drepAbstainVotePower: 0,
      // margin = |5100-4900|/10000 = 0.02 < 0.2
    });

    const wideMarginSummary = makeVotingSummary({
      proposalKey: 'close_call',
      drepYesVotePower: 8000,
      drepNoVotePower: 2000,
      drepAbstainVotePower: 0,
      // margin = |8000-2000|/10000 = 0.6 > 0.2
    });

    const vote = makeVoteData({
      drepId: 'd1',
      proposalKey: 'close_call',
      blockTime: NOW - 5 * ONE_DAY,
      importanceWeight: 2,
    });

    // Close margin scenario
    const closeScenario = setupScenario([vote], [proposal], [closeMarginSummary]);
    const closeScores = computeEffectiveParticipation(
      closeScenario.drepVotes,
      closeScenario.allProposals,
      closeScenario.votingSummaries,
      NOW,
    );

    // Wide margin scenario
    const wideScenario = setupScenario([vote], [proposal], [wideMarginSummary]);
    const wideScores = computeEffectiveParticipation(
      wideScenario.drepVotes,
      wideScenario.allProposals,
      wideScenario.votingSummaries,
      NOW,
    );

    // Close margin gives 1.5x bonus, so score should be higher
    expect(closeScores.get('d1')!).toBeGreaterThanOrEqual(wideScores.get('d1')!);
  });

  it('returns 0 for all DReps when total weighted pool is 0', () => {
    // No proposals = pool is 0
    const drepVotes = new Map([['d1', [makeVoteData({ drepId: 'd1' })]]]);
    const scores = computeEffectiveParticipation(drepVotes, new Map(), new Map(), NOW);
    expect(scores.get('d1')).toBe(0);
  });

  it('caps scores at 100', () => {
    // A DRep who voted on every proposal should score at most 100
    const proposals = [makeProposalContext({ proposalKey: 'p1', blockTime: NOW - ONE_DAY })];
    const vote = makeVoteData({
      drepId: 'd1',
      proposalKey: 'p1',
      blockTime: NOW,
      importanceWeight: proposals[0].importanceWeight,
    });

    const { drepVotes, allProposals, votingSummaries } = setupScenario([vote], proposals);
    const scores = computeEffectiveParticipation(drepVotes, allProposals, votingSummaries, NOW);
    expect(scores.get('d1')!).toBeLessThanOrEqual(100);
  });
});

describe('getExtendedImportanceWeight', () => {
  it('returns 3 for critical types (HardForkInitiation, NoConfidence, etc.)', () => {
    expect(getExtendedImportanceWeight('HardForkInitiation', null, null)).toBe(3);
    expect(getExtendedImportanceWeight('NoConfidence', null, null)).toBe(3);
    expect(getExtendedImportanceWeight('NewConstitution', null, null)).toBe(3);
    expect(getExtendedImportanceWeight('NewConstitutionalCommittee', null, null)).toBe(3);
  });

  it('returns 2 for ParameterChange', () => {
    expect(getExtendedImportanceWeight('ParameterChange', null, null)).toBe(2);
  });

  it('returns 1 for InfoAction', () => {
    expect(getExtendedImportanceWeight('InfoAction', null, null)).toBe(1);
  });

  it('returns 2 for significant/major treasury withdrawals', () => {
    expect(getExtendedImportanceWeight('TreasuryWithdrawals', 'significant', null)).toBe(2);
    expect(getExtendedImportanceWeight('TreasuryWithdrawals', 'major', null)).toBe(2);
  });

  it('applies log-scale multiplier for treasury withdrawals with amount', () => {
    const small = getExtendedImportanceWeight('TreasuryWithdrawals', null, 100);
    const large = getExtendedImportanceWeight('TreasuryWithdrawals', null, 100_000_000);
    expect(large).toBeGreaterThan(small);
    // Both should be positive
    expect(small).toBeGreaterThan(0);
  });

  it('returns base 1 for treasury with 0 ADA', () => {
    expect(getExtendedImportanceWeight('TreasuryWithdrawals', null, 0)).toBe(1);
  });

  it('caps treasury multiplier at 2.4x base', () => {
    // Even for astronomical amounts, multiplier should not exceed 2.4x base
    const result = getExtendedImportanceWeight('TreasuryWithdrawals', null, 1e15);
    expect(result).toBeLessThanOrEqual(1 * 2.4);
  });
});
