import * as React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SenecaMatch, buildAcknowledgement } from '@/components/governada/panel/SenecaMatch';

const {
  dispatchGlobeCommandMock,
  getSharedIntentMock,
  setSharedIntentMock,
  useIsTouchDeviceMock,
  vibrateMock,
} = vi.hoisted(() => ({
  dispatchGlobeCommandMock: vi.fn(),
  getSharedIntentMock: vi.fn(),
  setSharedIntentMock: vi.fn(),
  useIsTouchDeviceMock: vi.fn(),
  vibrateMock: vi.fn(),
}));

let currentIntent: Record<string, unknown>;

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
    button: ({ children, onClick, ...props }: Record<string, unknown>) => (
      <button onClick={onClick as () => void} {...props}>
        {children as React.ReactNode}
      </button>
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

vi.mock('posthog-js', () => ({
  default: { capture: vi.fn() },
}));

vi.mock('@/components/FeatureGate', () => ({
  useFeatureFlag: () => true,
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useIsTouchDevice: () => useIsTouchDeviceMock(),
}));

vi.mock('@/lib/globe/focusIntent', () => ({
  getSharedIntent: () => getSharedIntentMock(),
  setSharedIntent: (intent: Record<string, unknown>) => {
    currentIntent = intent;
    setSharedIntentMock(intent);
  },
}));

vi.mock('@/lib/globe/globeCommandBus', () => ({
  dispatchGlobeCommand: (command: unknown) => dispatchGlobeCommandMock(command),
}));

vi.mock('@/lib/globe/matchChoreography', () => ({
  buildRevealSequence: () => ({ type: 'sequence', steps: [] }),
  buildSpatialRevealSequence: () => ({ type: 'sequence', steps: [] }),
  buildMatchCleanupSequence: () => ({ type: 'sequence', steps: [] }),
}));

vi.mock('@/lib/globe/sequencer', () => ({
  flattenSequence: (sequence: unknown) => sequence,
  runSequence: () => ({ cancel: vi.fn(), done: Promise.resolve() }),
}));

vi.mock('@/lib/globe/userNodePlacement', () => ({
  computeUserNodePosition: () => [0, 0, 0],
  findClosestCluster: () => null,
}));

vi.mock('@/components/governada/MatchResultOverlay', () => ({
  MatchResultOverlay: () => <div data-testid="match-result-overlay" />,
}));

function renderMatch() {
  return render(<SenecaMatch onBack={vi.fn()} />);
}

describe('SenecaMatch', () => {
  beforeEach(() => {
    currentIntent = { focusedIds: 'all-dreps', dimStrength: 0.7 };
    getSharedIntentMock.mockImplementation(() => currentIntent);
    setSharedIntentMock.mockClear();
    dispatchGlobeCommandMock.mockClear();
    vibrateMock.mockClear();
    useIsTouchDeviceMock.mockReturnValue(false);
    vi.stubGlobal('navigator', { vibrate: vibrateMock });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('threads the remaining top-N count through acknowledgements', () => {
    expect(buildAcknowledgement(23, 0)).toBe('23. The field is thinning.');
    expect(buildAcknowledgement(7, 3)).toContain('7');
  });

  it('renders the spec setup wording', () => {
    renderMatch();

    expect(
      screen.getByText(/Representation begins with knowing what you want represented/),
    ).toBeTruthy();
  });

  it('previews a hypothetical answer on desktop hover and restores on leave', () => {
    renderMatch();
    setSharedIntentMock.mockClear();

    const option = screen.getByRole('button', { name: /Protect it/i });
    fireEvent.mouseEnter(option);

    expect(setSharedIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        focusedIds: 'from-alignment',
        dimStrength: 0.85,
        nodeTypeFilter: 'drep',
      }),
    );

    fireEvent.mouseLeave(option);

    expect(setSharedIntentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ focusedIds: 'all-dreps', dimStrength: 0.7 }),
    );
  });

  it('uses 350ms mobile long-press with haptic feedback and release dismissal', () => {
    vi.useFakeTimers();
    useIsTouchDeviceMock.mockReturnValue(true);
    renderMatch();
    setSharedIntentMock.mockClear();

    const option = screen.getByRole('button', { name: /Protect it/i });
    fireEvent.touchStart(option, { touches: [{ clientX: 0, clientY: 0 }] });
    vi.advanceTimersByTime(349);

    expect(setSharedIntentMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(vibrateMock).toHaveBeenCalledWith(10);
    expect(setSharedIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ focusedIds: 'from-alignment', dimStrength: 0.85 }),
    );

    fireEvent.touchEnd(option);

    expect(setSharedIntentMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ focusedIds: 'all-dreps', dimStrength: 0.7 }),
    );
  });

  it('cancels mobile long-press preview when touchmove exceeds 10px', () => {
    vi.useFakeTimers();
    useIsTouchDeviceMock.mockReturnValue(true);
    renderMatch();
    setSharedIntentMock.mockClear();

    const option = screen.getByRole('button', { name: /Protect it/i });
    fireEvent.touchStart(option, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(option, { touches: [{ clientX: 11, clientY: 0 }] });
    vi.advanceTimersByTime(350);

    expect(vibrateMock).not.toHaveBeenCalled();
    expect(setSharedIntentMock).not.toHaveBeenCalled();
  });

  it('renders the spec empty state and dims the constellation when no matches return', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        matches: [],
        nearMisses: [],
        userAlignments: {
          treasuryConservative: 50,
          treasuryGrowth: 50,
          decentralization: 50,
          security: 50,
          innovation: 50,
          transparency: 50,
        },
        personalityLabel: 'Balanced',
        identityColor: '#ffffff',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderMatch();
    setSharedIntentMock.mockClear();

    const answers = [
      /Protect it/i,
      /Stability first/i,
      /Non-negotiable/i,
      /Spread widely/i,
      /Voter apathy/i,
      /Regular updates/i,
      /Developer tooling/i,
    ];

    for (const label of answers) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(450);
      });
    }

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/No representative aligns strongly/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revisit' })).toBeTruthy();
    expect(setSharedIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ dimStrength: 1.0, forceActive: true }),
    );
  });

  it('publishes the reveal card through the Phase 6 AnchoredCard command', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/governance/constellation/clusters')) {
        return Promise.resolve({ ok: true, json: async () => ({ clusters: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          matches: [
            {
              drepId: 'drep1match',
              drepName: 'Aurelia DRep',
              drepScore: 88,
              matchScore: 77,
              identityColor: '#f59e0b',
              personalityLabel: 'Pragmatic Builder',
              alignments: {
                treasuryConservative: 50,
                treasuryGrowth: 50,
                decentralization: 50,
                security: 50,
                innovation: 50,
                transparency: 50,
              },
              agreeDimensions: ['Fiscal', 'Transparency'],
              differDimensions: ['Security'],
            },
          ],
          nearMisses: [],
          userAlignments: {
            treasuryConservative: 50,
            treasuryGrowth: 50,
            decentralization: 50,
            security: 50,
            innovation: 50,
            transparency: 50,
          },
          personalityLabel: 'Pragmatic Builder',
          identityColor: '#ffffff',
          confidenceBreakdown: { overall: 20, sources: [], nextAction: null },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    renderMatch();
    dispatchGlobeCommandMock.mockClear();

    const answers = [
      /Protect it/i,
      /Stability first/i,
      /Non-negotiable/i,
      /Spread widely/i,
      /Voter apathy/i,
      /Regular updates/i,
      /Developer tooling/i,
    ];

    for (const label of answers) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(450);
      });
    }

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText(/alignment is a beginning, not a verdict/)).toBeTruthy();
    expect(
      dispatchGlobeCommandMock.mock.calls.some(([command]) => {
        const maybe = command as {
          type?: string;
          cards?: Array<{ kind?: string; anchorNodeId?: string; autoDismissMs?: number | null }>;
        };
        return (
          maybe.type === 'anchoredCards' &&
          maybe.cards?.some(
            (card) =>
              card.kind === 'match' &&
              card.anchorNodeId === 'drep1match' &&
              card.autoDismissMs === null,
          )
        );
      }),
    ).toBe(true);
  });
});
