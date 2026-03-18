/**
 * Pill Generator — static governance-relevant questions with pill options
 * that map to alignment dimensions.
 *
 * 4 questions covering the 6 alignment dimensions:
 * 1. Treasury philosophy (treasuryConservative, treasuryGrowth)
 * 2. Technical priorities (security, innovation)
 * 3. Governance values (transparency, decentralization)
 * 4. Trade-off question (forces a stance across dimensions)
 */

import type { AlignmentScores } from '@/lib/drepIdentity';

export interface PillOption {
  id: string;
  text: string;
  alignmentHint: Partial<AlignmentScores>;
}

export interface QuestionSet {
  question: string;
  pills: PillOption[];
  targetDimensions: string[];
}

const QUESTIONS: QuestionSet[] = [
  // Round 1: Treasury philosophy
  {
    question: 'How should Cardano use its treasury?',
    targetDimensions: ['treasuryConservative', 'treasuryGrowth'],
    pills: [
      {
        id: 'treasury-preserve',
        text: 'Preserve it — only fund proven, essential projects',
        alignmentHint: { treasuryConservative: 85, treasuryGrowth: 20 },
      },
      {
        id: 'treasury-invest',
        text: 'Invest boldly — fund experiments that could 10x the ecosystem',
        alignmentHint: { treasuryConservative: 20, treasuryGrowth: 85 },
      },
      {
        id: 'treasury-balanced',
        text: 'Mix of both — steady funding with room for big bets',
        alignmentHint: { treasuryConservative: 55, treasuryGrowth: 60 },
      },
      {
        id: 'treasury-community',
        text: 'Let the community decide case by case',
        alignmentHint: { treasuryConservative: 50, treasuryGrowth: 50 },
      },
    ],
  },
  // Round 2: Technical priorities
  {
    question: 'What matters more for Cardano right now?',
    targetDimensions: ['security', 'innovation'],
    pills: [
      {
        id: 'tech-security',
        text: 'Rock-solid security — never rush changes to the protocol',
        alignmentHint: { security: 85, innovation: 25 },
      },
      {
        id: 'tech-innovation',
        text: 'Ship faster — we need features to compete with other chains',
        alignmentHint: { security: 25, innovation: 85 },
      },
      {
        id: 'tech-pragmatic',
        text: 'Move fast where safe, go slow on core protocol changes',
        alignmentHint: { security: 65, innovation: 60 },
      },
      {
        id: 'tech-research',
        text: 'Invest in research — long-term breakthroughs over quick wins',
        alignmentHint: { security: 70, innovation: 70 },
      },
    ],
  },
  // Round 3: Governance values
  {
    question: 'What kind of governance does Cardano need?',
    targetDimensions: ['transparency', 'decentralization'],
    pills: [
      {
        id: 'gov-transparent',
        text: 'Full transparency — every decision, vote, and rationale public',
        alignmentHint: { transparency: 90, decentralization: 70 },
      },
      {
        id: 'gov-decentralized',
        text: 'Maximum decentralization — no single entity should have outsized power',
        alignmentHint: { transparency: 65, decentralization: 90 },
      },
      {
        id: 'gov-efficient',
        text: 'Efficient governance — sometimes smaller groups decide faster',
        alignmentHint: { transparency: 40, decentralization: 25 },
      },
      {
        id: 'gov-evolving',
        text: 'Governance should evolve — start simple, decentralize over time',
        alignmentHint: { transparency: 60, decentralization: 55 },
      },
    ],
  },
  // Round 4: Trade-off — forces cross-dimensional stance
  {
    question: 'If you had to pick one priority for the next year, what would it be?',
    targetDimensions: [
      'treasuryConservative',
      'treasuryGrowth',
      'decentralization',
      'security',
      'innovation',
      'transparency',
    ],
    pills: [
      {
        id: 'tradeoff-growth',
        text: 'Fund 100 new projects — grow the ecosystem at all costs',
        alignmentHint: { treasuryGrowth: 90, innovation: 80, treasuryConservative: 15 },
      },
      {
        id: 'tradeoff-trust',
        text: 'Build trust — make governance so transparent that no one questions it',
        alignmentHint: { transparency: 90, decentralization: 75, security: 70 },
      },
      {
        id: 'tradeoff-resilience',
        text: 'Harden the protocol — security and stability above all else',
        alignmentHint: { security: 90, treasuryConservative: 75, innovation: 20 },
      },
      {
        id: 'tradeoff-power',
        text: 'Redistribute power — break up concentration wherever it exists',
        alignmentHint: { decentralization: 90, transparency: 70, treasuryConservative: 60 },
      },
    ],
  },
];

/**
 * Get the question set for a given round number (0-indexed).
 * Returns the static question for that round.
 * previousAnswers parameter reserved for future adaptive question selection.
 */
export function getQuestionForRound(
  roundNumber: number,
  _previousAnswers?: unknown[],
): QuestionSet | null {
  if (roundNumber < 0 || roundNumber >= QUESTIONS.length) return null;
  return QUESTIONS[roundNumber];
}

/** Total number of available questions. */
export const TOTAL_QUESTIONS = QUESTIONS.length;
