import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setAnswerMock = vi.fn();
const submitMock = vi.fn();
const resetMock = vi.fn();
const { quickMatchState } = vi.hoisted(() => ({
  quickMatchState: {
    answers: {},
    isComplete: false,
    isSubmitting: false,
    isSecondaryLoading: false,
    error: null,
    drepResult: null,
    spoResult: null,
  },
}));

vi.mock('@/hooks/useQuickMatch', () => ({
  useQuickMatch: () => ({
    state: quickMatchState,
    setAnswer: setAnswerMock,
    submit: submitMock,
    reset: resetMock,
  }),
}));

vi.mock('@/components/GovernanceRadar', () => ({
  GovernanceRadar: () => <div data-testid="governance-radar" />,
}));

vi.mock('@/components/matching/MatchConfidenceCTA', () => ({
  MatchConfidenceCTA: () => <div data-testid="match-confidence-cta" />,
}));

vi.mock('@/lib/posthog', () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

const { MatchExperienceClient } = await import('@/app/match/MatchExperienceClient');

describe('MatchExperienceClient', () => {
  beforeEach(() => {
    setAnswerMock.mockReset();
    submitMock.mockReset();
    resetMock.mockReset();
    Object.assign(quickMatchState, {
      answers: {},
      isComplete: false,
      isSubmitting: false,
      isSecondaryLoading: false,
      error: null,
      drepResult: null,
      spoResult: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the homepage-owned match intro contract', () => {
    render(<MatchExperienceClient />);

    expect(screen.getByTestId('match-start-button')).not.toBeNull();
    expect(screen.getByText(/A clean starting point for representative discovery/i)).not.toBeNull();
  });

  it('progresses from the intro into the first question flow', async () => {
    render(<MatchExperienceClient />);

    fireEvent.click(screen.getByTestId('match-start-button'));

    expect(await screen.findByTestId('match-question-treasury')).not.toBeNull();

    fireEvent.click(screen.getByTestId('match-answer-treasury-balanced'));

    expect(setAnswerMock).toHaveBeenCalledWith('treasury', 'balanced');
    expect(await screen.findByTestId('match-question-protocol')).not.toBeNull();
  });

  it('renders the truthful empty terminal state when no shortlist clears threshold', () => {
    Object.assign(quickMatchState, {
      drepResult: {
        matches: [],
        nearMisses: [],
        userAlignments: {
          treasuryConservative: 55,
          treasuryGrowth: 55,
          decentralization: 85,
          security: 55,
          innovation: 55,
          transparency: 90,
        },
        personalityLabel: 'Balanced Steward',
        identityColor: '#0ea5e9',
        confidenceBreakdown: {
          overall: 38,
          sources: [],
          nextAction: null,
        },
      },
    });

    render(<MatchExperienceClient />);

    expect(screen.getByTestId('match-empty-state')).not.toBeNull();
    expect(screen.getByText(/No strong match yet/i)).not.toBeNull();
  });
});
