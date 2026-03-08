import { describe, it, expect } from 'vitest';

import {
  calculateMatchConfidence,
  calculateProgressiveConfidence,
  type ConfidenceInputs,
} from '@/lib/matching/confidence';

// ── Legacy match confidence ──

describe('calculateMatchConfidence', () => {
  it('returns 0 for 0 overlapping votes', () => {
    expect(calculateMatchConfidence(0)).toBe(0);
  });

  it('scales linearly to 100 at 15 votes', () => {
    expect(calculateMatchConfidence(15)).toBe(100);
  });

  it('caps at 100 for > 15 votes', () => {
    expect(calculateMatchConfidence(30)).toBe(100);
  });

  it('returns 67 for 10 overlapping votes', () => {
    expect(calculateMatchConfidence(10)).toBe(67);
  });

  it('returns 33 for 5 overlapping votes', () => {
    expect(calculateMatchConfidence(5)).toBe(33);
  });
});

// ── Progressive confidence ──

describe('calculateProgressiveConfidence', () => {
  it('returns 0 for zero inputs', () => {
    const inputs: ConfidenceInputs = {
      quizAnswerCount: 0,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    };
    const result = calculateProgressiveConfidence(inputs);
    expect(result.overall).toBe(0);
    expect(result.sources.every((s) => s.score === 0)).toBe(true);
  });

  it('returns 100 for all maxed inputs', () => {
    const inputs: ConfidenceInputs = {
      quizAnswerCount: 3,
      pollVoteCount: 15,
      proposalTypesVoted: 4,
      engagementActionCount: 10,
      hasDelegation: true,
    };
    const result = calculateProgressiveConfidence(inputs);
    expect(result.overall).toBe(100);
  });

  it('quiz answers contribute up to 20 points', () => {
    const noQuiz = calculateProgressiveConfidence({
      quizAnswerCount: 0,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    const fullQuiz = calculateProgressiveConfidence({
      quizAnswerCount: 3,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    expect(fullQuiz.overall - noQuiz.overall).toBe(20);
  });

  it('poll votes contribute up to 40 points', () => {
    const noPoll = calculateProgressiveConfidence({
      quizAnswerCount: 0,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    const fullPoll = calculateProgressiveConfidence({
      quizAnswerCount: 0,
      pollVoteCount: 15,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    expect(fullPoll.overall - noPoll.overall).toBe(40);
  });

  it('delegation contributes exactly 15 points', () => {
    const noDelegation = calculateProgressiveConfidence({
      quizAnswerCount: 0,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    const withDelegation = calculateProgressiveConfidence({
      quizAnswerCount: 0,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: true,
    });
    expect(withDelegation.overall - noDelegation.overall).toBe(15);
  });

  it('suggests next action based on highest potential gain', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 3, // maxed
      pollVoteCount: 0, // empty → 40 point gap (highest)
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    expect(result.nextAction).not.toBeNull();
    expect(result.nextAction!.type).toBe('vote_proposals');
    expect(result.nextAction!.potentialGain).toBe(40);
  });

  it('returns null next action when all sources are maxed', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 3,
      pollVoteCount: 15,
      proposalTypesVoted: 4,
      engagementActionCount: 10,
      hasDelegation: true,
    });
    expect(result.nextAction).toBeNull();
  });

  it('has correct source keys', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 1,
      pollVoteCount: 5,
      proposalTypesVoted: 2,
      engagementActionCount: 3,
      hasDelegation: true,
    });
    const keys = result.sources.map((s) => s.key);
    expect(keys).toContain('quizAnswers');
    expect(keys).toContain('pollVotes');
    expect(keys).toContain('proposalDiversity');
    expect(keys).toContain('engagement');
    expect(keys).toContain('delegation');
  });

  it('caps input at target (no extra credit)', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 10, // way over target of 3
      pollVoteCount: 100, // way over target of 15
      proposalTypesVoted: 20,
      engagementActionCount: 100,
      hasDelegation: true,
    });
    expect(result.overall).toBe(100); // still 100, not higher
  });
});
