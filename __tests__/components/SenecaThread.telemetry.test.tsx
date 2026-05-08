import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThreadMessage } from '@/stores/senecaThreadStore';

const {
  captureSenecaInteractionMock,
  posthogCaptureMock,
  readAdvisorStreamMock,
  setPendingQueryMock,
  setMotionOverrideMock,
  pushMock,
} = vi.hoisted(() => ({
  captureSenecaInteractionMock: vi.fn(),
  posthogCaptureMock: vi.fn(),
  readAdvisorStreamMock: vi.fn(),
  setPendingQueryMock: vi.fn(),
  setMotionOverrideMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
}));

vi.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x" />,
  Trash2: () => <span data-testid="icon-trash" />,
  Settings2: () => <span data-testid="icon-settings" />,
}));

vi.mock('@/stores/senecaThreadStore', () => ({
  useSenecaThreadStore: (selector: (state: unknown) => unknown) =>
    selector({ setPendingQuery: setPendingQueryMock }),
}));

vi.mock('@/hooks/useEpochContext', () => ({
  useEpochContext: () => ({
    epoch: 600,
    daysRemaining: 3,
    activeProposalCount: 2,
  }),
}));

vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: () => ({ segment: 'anonymous' }),
}));

vi.mock('@/hooks/useSenecaSearch', () => ({
  useSenecaSearch: () => ({
    hasSearched: false,
    results: [],
    query: '',
    isSearching: false,
    error: null,
    search: vi.fn(),
    clearSearch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSenecaMemory', () => ({
  useSenecaMemory: () => ({
    memoryContext: '',
    saveConversation: vi.fn(),
  }),
}));

vi.mock('@/components/FeatureGate', () => ({
  useFeatureFlag: () => false,
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useViewportClass: () => 'desktop',
}));

vi.mock('@/lib/motion/motionStrength', () => ({
  useMotionStrengthSetter: () => ({
    userOverride: 'auto',
    setUserOverride: setMotionOverrideMock,
  }),
}));

vi.mock('@/lib/intelligence/streamAdvisor', () => ({
  readAdvisorStream: readAdvisorStreamMock,
  detectStreamTopic: () => null,
}));

vi.mock('@/lib/seneca/telemetry', () => ({
  captureSenecaInteraction: captureSenecaInteractionMock,
}));

vi.mock('@/lib/posthog', () => ({
  posthog: { capture: posthogCaptureMock },
}));

vi.mock('@/lib/telemetry/perfMarks', () => ({
  captureHomepageTiming: vi.fn(),
}));

vi.mock('@/lib/api/client', () => ({
  postJson: vi.fn(),
}));

vi.mock('@/lib/globe/globeCommandBus', () => ({
  dispatchGlobeCommand: vi.fn(),
}));

vi.mock('@/components/governada/CompassSigil', () => ({
  CompassSigil: () => <div data-testid="compass-sigil" />,
}));

vi.mock('@/components/governada/panel/SenecaMatch', () => ({
  SenecaMatch: () => <div data-testid="seneca-match" />,
}));

vi.mock('@/components/governada/panel/SenecaResearch', () => ({
  SenecaResearch: () => <div data-testid="seneca-research" />,
}));

vi.mock('@/components/governada/panel/SenecaInput', () => ({
  SenecaInput: ({ onSubmit }: { onSubmit: (query: string) => void }) => (
    <button type="button" onClick={() => onSubmit("What's a DRep?")}>
      Ask Seneca
    </button>
  ),
}));

vi.mock('@/components/governada/panel/SenecaMessages', () => ({
  ConversationContent: () => <div data-testid="conversation-content" />,
}));

vi.mock('@/components/governada/panel/SenecaSearchPanel', () => ({
  SearchResultsContent: () => <div data-testid="search-results" />,
}));

vi.mock('@/components/governada/panel/SenecaIdle', () => ({
  ROUTE_LABELS: { hub: 'Governance' },
  getQuickActions: () => [],
  getAnonOptions: () => [
    {
      label: 'Find a DRep',
      action: 'match',
      path: 'match',
    },
  ],
  getDiscoveryChips: () => [],
  sigilStateForMode: () => 'idle',
  IdleContent: ({
    anonOptions,
    onAnonOption,
  }: {
    anonOptions: Array<{ label: string; action: string; path?: string }>;
    onAnonOption: (option: { label: string; action: 'match'; path?: string }) => void;
  }) => (
    <button type="button" onClick={() => onAnonOption(anonOptions[0] as never)}>
      {anonOptions[0]?.label}
    </button>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/radio-group', () => {
  const RadioContext = React.createContext<(value: string) => void>(() => undefined);
  return {
    RadioGroup: ({
      children,
      onValueChange,
      ...props
    }: {
      children: React.ReactNode;
      onValueChange: (value: string) => void;
    }) => (
      <RadioContext.Provider value={onValueChange}>
        <div {...props}>{children}</div>
      </RadioContext.Provider>
    ),
    RadioGroupItem: ({ value }: { value: string }) => {
      const onValueChange = React.useContext(RadioContext);
      return (
        <button type="button" aria-label={`motion-${value}`} onClick={() => onValueChange(value)} />
      );
    },
  };
});

const { SenecaThread } = await import('@/components/governada/SenecaThread');

function renderSenecaThread(
  props: Partial<React.ComponentProps<typeof SenecaThread>> = {},
  messages: ThreadMessage[] = [],
) {
  return render(
    <SenecaThread
      isOpen
      onClose={vi.fn()}
      mode="idle"
      persona={{ id: 'navigator', label: 'Navigator' }}
      panelRoute="hub"
      world="home"
      messages={messages}
      onStartConversation={vi.fn()}
      onStartResearch={vi.fn()}
      onStartMatch={vi.fn()}
      onReturnToIdle={vi.fn()}
      onAddMessage={vi.fn()}
      onUpdateLastAssistant={vi.fn()}
      onClearConversation={vi.fn()}
      isAuthenticated={false}
      {...props}
    />,
  );
}

async function settlePanelOpen() {
  await waitFor(() =>
    expect(captureSenecaInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'panel_opened' }),
    ),
  );
  captureSenecaInteractionMock.mockClear();
}

describe('SenecaThread telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('captures panel dismissal source', async () => {
    const onClose = vi.fn();
    renderSenecaThread({ onClose });
    await settlePanelOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Close Seneca' }));

    expect(captureSenecaInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'panel_dismissed',
        source: 'close_button',
        panel_route: 'hub',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('captures guided path selection from onboarding options', async () => {
    const onStartMatch = vi.fn();
    renderSenecaThread({ onStartMatch });
    await settlePanelOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Find a DRep' }));

    expect(captureSenecaInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'guided_path_taken',
        path: 'match',
        label: 'Find a DRep',
        source: 'onboarding',
      }),
    );
    expect(onStartMatch).toHaveBeenCalled();
  });

  it('captures mechanical question asked before answering locally', async () => {
    renderSenecaThread({
      mode: 'conversation',
      pendingQuery: "What's a DRep?",
    });

    await waitFor(() =>
      expect(captureSenecaInteractionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'mechanical_question_asked',
          question_type: 'what_s_a_drep',
          source: 'seneca_panel',
          panel_route: 'hub',
        }),
      ),
    );
    expect(readAdvisorStreamMock).not.toHaveBeenCalled();
  });

  it('captures advisor observations when streaming completes', async () => {
    readAdvisorStreamMock.mockImplementationOnce((...args: unknown[]) => {
      const onComplete = args[4] as () => void;
      onComplete();
    });
    renderSenecaThread({
      mode: 'conversation',
      pendingQuery: 'Tell me what changed',
    });

    await waitFor(() =>
      expect(captureSenecaInteractionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'observation_surfaced',
          source: 'advisor_stream',
          panel_route: 'hub',
        }),
      ),
    );
  });

  it('captures Seneca answer failures with route attribution', async () => {
    readAdvisorStreamMock.mockImplementationOnce((...args: unknown[]) => {
      const onError = args[3] as (error: unknown) => void;
      onError(new Error('advisor unavailable'));
    });
    renderSenecaThread({
      mode: 'conversation',
      pendingQuery: 'Tell me what changed',
    });

    await waitFor(() =>
      expect(posthogCaptureMock).toHaveBeenCalledWith('seneca_answer_failed', {
        error: 'advisor unavailable',
        intent: 'observational',
        panel_route: 'hub',
      }),
    );
    expect(captureSenecaInteractionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'observation_surfaced',
        source: 'evergreen_fallback',
        panel_route: 'hub',
      }),
    );
  });

  it('captures motion setting changes', async () => {
    renderSenecaThread();
    await settlePanelOpen();

    fireEvent.click(screen.getByRole('button', { name: 'Seneca settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'motion-suspended' }));

    expect(captureSenecaInteractionMock).toHaveBeenCalledWith({
      kind: 'motion_setting_changed',
      source: 'seneca_settings',
      from: 'auto',
      to: 'suspended',
    });
    expect(setMotionOverrideMock).toHaveBeenCalledWith('suspended');
  });
});
