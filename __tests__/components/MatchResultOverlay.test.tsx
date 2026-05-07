import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchResultOverlay } from '@/components/governada/MatchResultOverlay';
import type { QuickMatchResponse } from '@/hooks/useQuickMatch';
import { VALUES_ONLY_BASELINE_CONFIDENCE } from '@/lib/matching/confidence';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/DelegateButton', () => ({
  DelegateButton: ({ drepId }: { drepId: string }) => (
    <button type="button">Delegate {drepId}</button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button {...props}>{children}</button>,
}));

const result: QuickMatchResponse = {
  matches: [],
  userAlignments: {
    treasuryConservative: 50,
    treasuryGrowth: 60,
    decentralization: 55,
    security: 45,
    innovation: 70,
    transparency: 65,
  },
  personalityLabel: 'Pragmatic Builder',
  identityColor: '#38bdf8',
  confidenceBreakdown: {
    overall: VALUES_ONLY_BASELINE_CONFIDENCE,
    sources: [
      {
        key: 'quizAnswers',
        label: 'Quick Match quiz',
        score: VALUES_ONLY_BASELINE_CONFIDENCE,
        maxScore: VALUES_ONLY_BASELINE_CONFIDENCE,
        current: 4,
        target: 4,
        active: true,
      },
    ],
    nextAction: null,
  },
};

const focusedMatch = {
  drepId: 'drep1match',
  drepName: 'Aurelia DRep',
  drepScore: 82,
  matchScore: 76,
  identityColor: '#f59e0b',
  personalityLabel: 'Pragmatic Builder',
  alignments: {
    treasuryConservative: 52,
    treasuryGrowth: 62,
    decentralization: 58,
    security: 42,
    innovation: 75,
    transparency: 66,
  },
  agreeDimensions: ['Fiscal', 'Transparency', 'Innovation'],
  differDimensions: ['Security', 'Growth', 'Decentralization'],
  tier: 'Gold',
  signatureInsight: 'Strongest on transparency',
};

describe('MatchResultOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the vote CTA with the focused DRep id', () => {
    render(
      <MatchResultOverlay
        result={result}
        focusedMatch={focusedMatch}
        focusedRank={1}
        isTopMatch
        onBackToTop={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('link', { name: /Strengthen with proposal voting/i }).getAttribute('href'),
    ).toBe('/match/vote?drepId=drep1match');
  });

  it('limits the agreement display to max two agree and one differ', () => {
    render(
      <MatchResultOverlay
        result={result}
        focusedMatch={focusedMatch}
        focusedRank={1}
        isTopMatch
        onBackToTop={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/Fiscal/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Transparency/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Innovation ✓/)).toBeNull();
    expect(screen.getAllByText(/Security/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Growth ✗/)).toBeNull();
  });

  it('surfaces the three confidence reference points from the confidence model', () => {
    render(
      <MatchResultOverlay
        result={result}
        focusedMatch={focusedMatch}
        focusedRank={1}
        isTopMatch
        onBackToTop={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText('values-only baseline')).toBeTruthy();
    expect(screen.getByText('current score')).toBeTruthy();
    expect(screen.getByText('strong working signal')).toBeTruthy();
    expect(screen.getAllByText(String(VALUES_ONLY_BASELINE_CONFIDENCE)).length).toBeGreaterThan(0);
  });
});
