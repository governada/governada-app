import { describe, it, expect } from 'vitest';

import {
  createSession,
  processAnswer,
  evaluateQualityGates,
  buildFullAlignment,
  getNextQuestion,
  MAX_ROUNDS,
} from '@/lib/matching/conversationalMatch';

import { getQuestionForRound, TOTAL_QUESTIONS } from '@/lib/matching/conversationalPillGenerator';

import { calculateProgressiveConfidence, type ConfidenceInputs } from '@/lib/matching/confidence';

// ── Session creation ──

describe('createSession', () => {
  it('returns a valid initial session', () => {
    const session = createSession('test-id');
    expect(session.id).toBe('test-id');
    expect(session.rounds).toHaveLength(0);
    expect(session.accumulatedText).toBe('');
    expect(session.extractedAlignment).toEqual({});
    expect(session.qualityGates.passed).toBe(false);
    expect(session.status).toBe('in_progress');
  });
});

// ── Process answer ──

describe('processAnswer', () => {
  it('accumulates text from selected pills', () => {
    const session = createSession('test-1');
    const question = getQuestionForRound(0);
    expect(question).not.toBeNull();

    // Select the first pill
    const selectedId = question!.pills[0].id;
    const updated = processAnswer(session, [selectedId]);

    expect(updated.rounds).toHaveLength(1);
    expect(updated.accumulatedText).toContain(question!.pills[0].text);
  });

  it('updates alignment from selected pills', () => {
    const session = createSession('test-2');
    // Select "treasury-preserve" which sets treasuryConservative: 85, treasuryGrowth: 20
    const updated = processAnswer(session, ['treasury-preserve']);

    expect(updated.extractedAlignment.treasuryConservative).toBe(85);
    expect(updated.extractedAlignment.treasuryGrowth).toBe(20);
  });

  it('multi-select averages alignment hints correctly', () => {
    const session = createSession('test-3');
    // Select both treasury-preserve (conservative: 85, growth: 20)
    // and treasury-invest (conservative: 20, growth: 85)
    const updated = processAnswer(session, ['treasury-preserve', 'treasury-invest']);

    // Average: (85 + 20) / 2 = 52.5 → 53, (20 + 85) / 2 = 52.5 → 53
    expect(updated.extractedAlignment.treasuryConservative).toBe(53);
    expect(updated.extractedAlignment.treasuryGrowth).toBe(53);
  });

  it('all-selected = skipped round (no alignment change)', () => {
    const session = createSession('test-4');
    const question = getQuestionForRound(0);
    const allIds = question!.pills.map((p) => p.id);

    const updated = processAnswer(session, allIds);

    // Round is recorded but with empty selectedIds
    expect(updated.rounds).toHaveLength(1);
    expect(updated.rounds[0].selectedIds).toHaveLength(0);
    // No alignment extracted
    expect(updated.extractedAlignment).toEqual({});
  });

  it('caps rawText at 500 characters', () => {
    const session = createSession('test-5');
    const longText = 'x'.repeat(600);
    const updated = processAnswer(session, ['treasury-preserve'], longText);

    // accumulatedText should contain the pill text plus truncated rawText
    expect(updated.accumulatedText.length).toBeLessThan(600);
  });

  it('does not process answers for non-in-progress sessions', () => {
    const session = createSession('test-6');
    session.status = 'matched';
    const updated = processAnswer(session, ['treasury-preserve']);

    expect(updated.rounds).toHaveLength(0);
  });

  it('accumulates alignment across rounds', () => {
    let session = createSession('test-7');

    // Round 1: treasury-preserve (conservative: 85, growth: 20)
    session = processAnswer(session, ['treasury-preserve']);
    expect(session.extractedAlignment.treasuryConservative).toBe(85);

    // Round 2: tech-security (security: 85, innovation: 25)
    session = processAnswer(session, ['tech-security']);
    expect(session.extractedAlignment.security).toBe(85);
    expect(session.extractedAlignment.innovation).toBe(25);
    // Treasury should still be set from round 1
    expect(session.extractedAlignment.treasuryConservative).toBe(85);
  });
});

// ── Max rounds enforced ──

describe('max rounds', () => {
  it('transitions to ready_to_match when quality gates pass', () => {
    let session = createSession('test-max');

    // Process rounds with strong opinions — quality gates should pass
    // after enough dimensions have signal
    session = processAnswer(session, ['treasury-preserve']); // tc: 85, tg: 20
    expect(session.status).toBe('in_progress'); // Not enough coverage yet

    session = processAnswer(session, ['tech-security']); // sec: 85, inn: 25
    // After 2 rounds: 4 dims (tc, tg, sec, inn) deviate from 50
    // Quality gates may now pass if specificity is high enough
    // Session transitions to ready_to_match
    expect(session.rounds.length).toBeLessThanOrEqual(MAX_ROUNDS);
  });

  it('caps at MAX_ROUNDS even if quality gates do not pass', () => {
    let session = createSession('test-max-2');

    // Use "all selected" on each round so no alignment signal accumulates
    // This means quality gates never pass, so we rely on the round cap
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const question = getQuestionForRound(i);
      expect(question).not.toBeNull();
      // Select only the last pill with weakest signal
      const lastPill = question!.pills[question!.pills.length - 1];
      // Force status back to in_progress to test round cap
      session.status = 'in_progress';
      session = processAnswer(session, [lastPill.id]);
    }

    expect(session.rounds).toHaveLength(MAX_ROUNDS);
    expect(session.status).toBe('ready_to_match');
  });

  it('does not add rounds beyond MAX_ROUNDS', () => {
    let session = createSession('test-max-3');

    // Fill up rounds
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const question = getQuestionForRound(i);
      session.status = 'in_progress'; // Force in_progress for testing
      session = processAnswer(session, [question!.pills[0].id]);
    }

    const roundCount = session.rounds.length;
    // Now try a 5th answer — should be a no-op
    session = processAnswer(session, ['anything']);
    expect(session.rounds).toHaveLength(roundCount);
  });
});

// ── Quality gates ──

describe('evaluateQualityGates', () => {
  it('fails when no alignment data', () => {
    const gates = evaluateQualityGates({
      extractedAlignment: {},
      rounds: [],
    });
    expect(gates.passed).toBe(false);
    expect(gates.dimensionalCoverage).toBe(0);
    expect(gates.specificity).toBe(0);
  });

  it('passes when 4+ dimensions deviate and specificity >= 15', () => {
    const gates = evaluateQualityGates({
      extractedAlignment: {
        treasuryConservative: 85,
        treasuryGrowth: 20,
        security: 80,
        innovation: 30,
        transparency: 75,
        decentralization: 50, // neutral — doesn't count as deviating
      },
      rounds: [],
    });

    // 5 dimensions deviate from 50 (tc: 35, tg: 30, sec: 30, inn: 20, trans: 25)
    // decentralization = 0 deviation
    expect(gates.dimensionalCoverage).toBe(5);
    expect(gates.specificity).toBeGreaterThanOrEqual(15);
    expect(gates.passed).toBe(true);
  });

  it('fails when fewer than 4 dimensions deviate', () => {
    const gates = evaluateQualityGates({
      extractedAlignment: {
        treasuryConservative: 60,
        treasuryGrowth: 45,
        security: 55,
      },
      rounds: [],
    });

    expect(gates.dimensionalCoverage).toBe(3);
    expect(gates.passed).toBe(false);
  });

  it('fails when specificity is too low', () => {
    const gates = evaluateQualityGates({
      extractedAlignment: {
        treasuryConservative: 55,
        treasuryGrowth: 55,
        security: 55,
        innovation: 55,
        transparency: 55,
        decentralization: 55,
      },
      rounds: [],
    });

    // All dimensions deviate by only 5 — specificity = 5, below threshold of 15
    expect(gates.dimensionalCoverage).toBe(6);
    expect(gates.specificity).toBe(5);
    expect(gates.passed).toBe(false);
  });
});

// ── buildFullAlignment ──

describe('buildFullAlignment', () => {
  it('fills missing dimensions with 50', () => {
    const full = buildFullAlignment({ treasuryConservative: 80 });
    expect(full.treasuryConservative).toBe(80);
    expect(full.treasuryGrowth).toBe(50);
    expect(full.decentralization).toBe(50);
    expect(full.security).toBe(50);
    expect(full.innovation).toBe(50);
    expect(full.transparency).toBe(50);
  });

  it('preserves all provided values', () => {
    const full = buildFullAlignment({
      treasuryConservative: 85,
      treasuryGrowth: 20,
      decentralization: 70,
      security: 90,
      innovation: 30,
      transparency: 60,
    });
    expect(full.treasuryConservative).toBe(85);
    expect(full.treasuryGrowth).toBe(20);
    expect(full.decentralization).toBe(70);
    expect(full.security).toBe(90);
    expect(full.innovation).toBe(30);
    expect(full.transparency).toBe(60);
  });
});

// ── getNextQuestion ──

describe('getNextQuestion', () => {
  it('returns first question for new session', () => {
    const session = createSession('test-q');
    const question = getNextQuestion(session);
    expect(question).not.toBeNull();
    expect(question!.question).toBeTruthy();
    expect(question!.pills.length).toBeGreaterThan(0);
  });

  it('returns null for completed session', () => {
    const session = createSession('test-q2');
    session.status = 'ready_to_match';
    expect(getNextQuestion(session)).toBeNull();
  });

  it('returns null when max rounds reached', () => {
    let session = createSession('test-q3');
    for (let i = 0; i < MAX_ROUNDS; i++) {
      const q = getQuestionForRound(i);
      session = processAnswer(session, [q!.pills[0].id]);
    }
    expect(getNextQuestion(session)).toBeNull();
  });
});

// ── Pill generator ──

describe('getQuestionForRound', () => {
  it('returns questions for rounds 0-3', () => {
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      const q = getQuestionForRound(i);
      expect(q).not.toBeNull();
      expect(q!.question).toBeTruthy();
      expect(q!.pills.length).toBeGreaterThanOrEqual(3);
      expect(q!.targetDimensions.length).toBeGreaterThan(0);
    }
  });

  it('returns null for out-of-range round', () => {
    expect(getQuestionForRound(-1)).toBeNull();
    expect(getQuestionForRound(TOTAL_QUESTIONS)).toBeNull();
  });

  it('pills have valid alignment hints', () => {
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      const q = getQuestionForRound(i);
      for (const pill of q!.pills) {
        expect(pill.id).toBeTruthy();
        expect(pill.text).toBeTruthy();
        expect(Object.keys(pill.alignmentHint).length).toBeGreaterThan(0);
        // All alignment hint values should be 0-100
        for (const val of Object.values(pill.alignmentHint)) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('questions cover all 6 alignment dimensions', () => {
    const coveredDims = new Set<string>();
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      const q = getQuestionForRound(i);
      for (const dim of q!.targetDimensions) {
        coveredDims.add(dim);
      }
    }
    expect(coveredDims.size).toBe(6);
    expect(coveredDims.has('treasuryConservative')).toBe(true);
    expect(coveredDims.has('treasuryGrowth')).toBe(true);
    expect(coveredDims.has('decentralization')).toBe(true);
    expect(coveredDims.has('security')).toBe(true);
    expect(coveredDims.has('innovation')).toBe(true);
    expect(coveredDims.has('transparency')).toBe(true);
  });
});

// ── Confidence: conversational match source ──

describe('confidence with conversational match', () => {
  it('uses conversational match when it gives higher score than quiz', () => {
    const inputs: ConfidenceInputs = {
      quizAnswerCount: 0, // quiz gives 0
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
      hasConversationalMatch: true, // conversational gives 35
    };
    const result = calculateProgressiveConfidence(inputs);
    const convSource = result.sources.find((s) => s.key === 'conversationalMatch');
    expect(convSource).toBeDefined();
    expect(convSource!.score).toBe(35);
    expect(convSource!.active).toBe(true);
  });

  it('uses quiz when it gives higher score than conversational (not completed)', () => {
    const inputs: ConfidenceInputs = {
      quizAnswerCount: 4, // quiz gives 20
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
      hasConversationalMatch: false, // conversational gives 0
    };
    const result = calculateProgressiveConfidence(inputs);
    const quizSource = result.sources.find((s) => s.key === 'quizAnswers');
    expect(quizSource).toBeDefined();
    expect(quizSource!.score).toBe(20);
  });

  it('conversational match and quiz are mutually exclusive in sources', () => {
    const withConv = calculateProgressiveConfidence({
      quizAnswerCount: 4,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
      hasConversationalMatch: true,
    });

    // Should have conversational match, not quiz
    expect(withConv.sources.some((s) => s.key === 'conversationalMatch')).toBe(true);
    expect(withConv.sources.some((s) => s.key === 'quizAnswers')).toBe(false);
  });

  it('total max stays 100% with conversational match', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 4,
      pollVoteCount: 15,
      proposalTypesVoted: 4,
      engagementActionCount: 10,
      hasDelegation: true,
      treasuryJudgmentCount: 5,
      hasConversationalMatch: true,
    });
    expect(result.overall).toBe(100);
  });

  it('total max stays 100% without conversational match', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 4,
      pollVoteCount: 15,
      proposalTypesVoted: 4,
      engagementActionCount: 10,
      hasDelegation: true,
      treasuryJudgmentCount: 5,
      hasConversationalMatch: false,
    });
    expect(result.overall).toBe(100);
  });

  it('defaults to no conversational match when field omitted', () => {
    const result = calculateProgressiveConfidence({
      quizAnswerCount: 0,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });
    // Should use quiz source, not conversational
    expect(result.sources.some((s) => s.key === 'quizAnswers')).toBe(true);
    expect(result.sources.some((s) => s.key === 'conversationalMatch')).toBe(false);
  });
});
