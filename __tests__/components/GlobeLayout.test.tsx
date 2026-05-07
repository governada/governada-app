import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnchoredCardDescriptor } from '@/components/globe/AnchoredCard';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const push = vi.fn();
const replace = vi.fn();
const startMatch = vi.fn();
const executeGlobeCommand = vi.fn();
const setHomepageAnchoredCards = vi.fn();
let homepageCinematic: unknown = null;
let viewportClass: 'mobile' | 'desktop' = 'desktop';
let isTouchDevice = false;
let bridgeOptions: { onAnchoredCards?: (cards: AnchoredCardDescriptor[]) => void } | null = null;

const selectableNode = {
  id: 'drep_abc123',
  fullId: 'drep_abc123',
  label: 'Ada DRep',
  nodeType: 'drep',
  alignments: [50, 50, 50, 50, 50, 50],
  position: [1, 0, 0],
  activity: 0.5,
  clusterId: null,
  neighbors: [],
} as unknown as ConstellationNode3D;

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
    const DynamicComponent = React.forwardRef<any, any>((props, ref) => {
      const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);

      React.useEffect(() => {
        let active = true;
        loader().then((mod) => {
          if (active) setComponent(() => mod.default);
        });
        return () => {
          active = false;
        };
      }, []);

      if (!Component) return null;
      return <Component ref={ref} {...props} />;
    });

    DynamicComponent.displayName = 'DynamicMock';
    return DynamicComponent;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/hooks/useSenecaGlobeBridge', () => ({
  useSenecaGlobeBridge: (
    _globeRef: unknown,
    options?: { onAnchoredCards?: (cards: AnchoredCardDescriptor[]) => void },
  ) => {
    bridgeOptions = options ?? null;
    return {
      handleNodeClick: vi.fn(),
      executeGlobeCommand,
    };
  },
}));

vi.mock('@/hooks/useViewportClass', () => ({
  useViewportClass: () => viewportClass,
  useIsTouchDevice: () => isTouchDevice,
}));

vi.mock('@/hooks/useSenecaThread', () => ({
  useSenecaThread: () => ({
    pendingGlobeAction: null,
    consumeGlobeAction: vi.fn(),
    isOpen: false,
    close: vi.fn(),
    homepageCinematic,
  }),
}));

vi.mock('@/hooks/useGlobeCommandListener', () => ({
  useGlobeCommandListener: vi.fn(),
}));

vi.mock('@/components/providers/SegmentProvider', () => ({
  useSegment: () => ({ segment: 'anonymous', drepId: null }),
}));

vi.mock('@/hooks/useDeviceCapability', () => ({
  useDeviceCapability: () => ({
    gpuTier: 'high',
    isTouch: false,
    isMobile: false,
    use2D: false,
  }),
}));

vi.mock('@/hooks/useUserConstellationNode', () => ({
  useUserConstellationNode: () => ({
    userNode: null,
    delegationBond: null,
    isLoading: false,
    hasAlignmentData: false,
    userAlignments: null,
  }),
}));

vi.mock('@/hooks/useConstellationProposals', () => ({
  useConstellationProposals: () => ({
    proposalNodes: [],
  }),
}));

vi.mock('@/stores/senecaThreadStore', () => {
  const useSenecaThreadStore = (selector: (state: unknown) => unknown) =>
    selector({ setHomepageAnchoredCards });
  useSenecaThreadStore.getState = () => ({
    startMatch,
  });
  return { useSenecaThreadStore };
});

vi.mock('@/components/FeatureGate', () => ({
  useFeatureFlag: () => false,
}));

vi.mock('@/lib/funnel', () => ({
  FUNNEL_EVENTS: { LANDING_VIEWED: 'landing_viewed' },
  trackFunnel: vi.fn(),
}));

vi.mock('@/lib/posthog', () => ({
  posthog: {
    capture: vi.fn(),
  },
}));

vi.mock('@/lib/persistence', () => ({
  STORAGE_KEYS: { lastVisit: 'lastVisit' },
  readStoredValue: vi.fn(() => null),
}));

vi.mock('@/lib/globe/behaviors/clusterBehavior', () => ({
  setClusterCache: vi.fn(),
}));

vi.mock('@/components/ConstellationScene', () => ({
  ConstellationScene: React.forwardRef(
    (props: { onNodeSelect?: (node: ConstellationNode3D) => void }, _ref) => (
      <button
        type="button"
        data-testid="scene"
        onClick={() => props.onNodeSelect?.(selectableNode)}
      >
        scene
      </button>
    ),
  ),
}));

vi.mock('@/components/globe/Constellation2D', () => ({
  Constellation2D: React.forwardRef((_props, _ref) => <div data-testid="scene-2d" />),
}));

vi.mock('@/components/globe/ListOverlay', () => ({
  ListOverlay: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="list-overlay" /> : null,
}));

vi.mock('@/components/globe/WorkspaceCards', () => ({
  WorkspaceCards: () => <div data-testid="workspace-cards" />,
}));

vi.mock('@/components/governada/GlobeTooltip', () => ({
  GlobeTooltip: ({ node }: { node: unknown }) =>
    node ? <div data-testid="globe-tooltip" /> : null,
}));

vi.mock('@/components/globe/PanelOverlay', () => ({
  PanelOverlay: ({ onClose }: { onClose?: () => void }) =>
    onClose ? <div data-testid="panel-overlay" /> : null,
}));

vi.mock('@/components/hub/EntityDetailSheet', () => ({
  EntityDetailSheet: ({ entity }: { entity: unknown }) =>
    entity ? <div data-testid="entity-detail-sheet" /> : null,
}));

vi.mock('@/components/SinceLastVisit', () => ({
  SinceLastVisit: () => <div data-testid="since-last-visit" />,
}));

vi.mock('@/components/hub/DiscoveryOverlay', () => ({
  DiscoveryOverlay: ({ filter }: { filter: string | null }) =>
    filter ? <div data-testid="discovery-overlay" /> : null,
}));

vi.mock('@/components/globe/GlobeControls', () => ({
  GlobeControls: () => <div data-testid="globe-controls" />,
}));

vi.mock('@/components/globe/ClusterLabels3D', () => ({
  ClusterLabels3D: () => <div data-testid="cluster-labels" />,
}));

vi.mock('@/components/globe/ClusterNebula', () => ({
  ClusterNebulae: () => <div data-testid="cluster-nebulae" />,
}));

import { GlobeLayout, isLayer2CinematicStateEnabled } from '@/components/globe/GlobeLayout';

function renderGlobeLayout(props: React.ComponentProps<typeof GlobeLayout> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<GlobeLayout {...props} />, { wrapper: Wrapper });
}

describe('GlobeLayout deferred panels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    homepageCinematic = null;
    viewportClass = 'desktop';
    isTouchDevice = false;
    bridgeOptions = null;
    setHomepageAnchoredCards.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('keeps overlay-only panels out of the initial homepage render', async () => {
    renderGlobeLayout();

    await waitFor(() => expect(screen.getByTestId('scene')).toBeTruthy());
    expect(screen.queryByTestId('list-overlay')).toBeNull();
    expect(screen.queryByTestId('discovery-overlay')).toBeNull();
    expect(screen.queryByTestId('entity-detail-sheet')).toBeNull();
    expect(screen.queryByTestId('globe-tooltip')).toBeNull();

    fireEvent.keyDown(window, { key: 'l' });

    await waitFor(() => expect(screen.getByTestId('list-overlay')).toBeTruthy());
  });

  it('loads the discovery overlay only when a filter is active', async () => {
    renderGlobeLayout({ initialFilter: 'dreps' });

    await waitFor(() => expect(screen.getByTestId('scene')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('discovery-overlay')).toBeTruthy());
    expect(screen.queryByTestId('list-overlay')).toBeNull();
  });

  it('loads the entity detail sheet only when an entity is selected', async () => {
    renderGlobeLayout({ initialEntity: 'drep_abc123' });

    await waitFor(() => expect(screen.getByTestId('scene')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('entity-detail-sheet')).toBeTruthy());
    expect(screen.queryByTestId('discovery-overlay')).toBeNull();
  });

  it('dispatches homepage cinema entry and exit through the local globe bridge', async () => {
    homepageCinematic = makeHomepageCinematicSnapshot('returning_quiet', 'quiet-fixture');
    const { rerender } = renderGlobeLayout();

    await waitFor(() =>
      expect(executeGlobeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cinemaStrength',
          phase: 'enter',
          state: 'returning_quiet',
        }),
      ),
    );
    expect(executeGlobeCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cinema:returning_quiet' }),
    );

    executeGlobeCommand.mockClear();
    homepageCinematic = makeHomepageCinematicSnapshot('action_required', 'action-fixture');
    rerender(<GlobeLayout />);

    await waitFor(() =>
      expect(executeGlobeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cinemaStrength',
          phase: 'exit',
          state: 'returning_quiet',
        }),
      ),
    );
    await waitFor(() =>
      expect(executeGlobeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cinema:action_required' }),
      ),
    );
  });

  it('uses touch first-tap preview and second-tap entity sheet', async () => {
    viewportClass = 'mobile';
    isTouchDevice = true;
    renderGlobeLayout();

    const scene = await screen.findByTestId('scene');
    fireEvent.click(scene);

    await waitFor(() => expect(screen.getByTestId('globe-tooltip')).toBeTruthy());
    expect(screen.queryByTestId('entity-detail-sheet')).toBeNull();

    await waitForTouchDuplicateGuard();
    fireEvent.click(scene);

    await waitFor(() => expect(screen.getByTestId('entity-detail-sheet')).toBeTruthy());
  });

  it('uses anchored cards as the touch preview surface', async () => {
    viewportClass = 'mobile';
    isTouchDevice = true;
    renderGlobeLayout();

    const scene = await screen.findByTestId('scene');
    act(() => {
      bridgeOptions?.onAnchoredCards?.([
        {
          id: 'anchored-drep',
          kind: 'action',
          title: 'Review Ada DRep',
          anchorNodeId: selectableNode.id,
        },
      ]);
    });
    await waitFor(() => expect(screen.getByTestId('anchored-card-mobile')).toBeTruthy());

    fireEvent.click(scene);

    expect(screen.queryByTestId('globe-tooltip')).toBeNull();
    expect(screen.getByTestId('anchored-card-mobile')).toBeTruthy();

    await waitForTouchDuplicateGuard();
    fireEvent.click(scene);

    await waitFor(() => expect(screen.getByTestId('entity-detail-sheet')).toBeTruthy());
  });

  it('keeps Layer 2 idle effects gated to quiet returning states', () => {
    expect(isLayer2CinematicStateEnabled('returning_quiet')).toBe(true);
    expect(isLayer2CinematicStateEnabled('returning_in_session')).toBe(true);
    expect(isLayer2CinematicStateEnabled('civic_event_tier_0')).toBe(false);
    expect(isLayer2CinematicStateEnabled(null)).toBe(false);
  });
});

function makeHomepageCinematicSnapshot(state: 'returning_quiet' | 'action_required', id: string) {
  return {
    identity: { segment: 'anonymous' },
    queue: {
      primary: {
        id,
        tier: state === 'action_required' ? 1 : 2,
        kind: state === 'action_required' ? 'crisp' : 'informational',
        state,
        surfaced_at: '2026-05-06T00:00:00.000Z',
        payload: state === 'action_required' ? { items: [] } : {},
      },
      secondary: [],
      meta: {
        reasoning: `${id} reasoning`,
        generatedAt: '2026-05-06T00:00:00.000Z',
      },
    },
  };
}

function waitForTouchDuplicateGuard() {
  return new Promise((resolve) => setTimeout(resolve, 300));
}
