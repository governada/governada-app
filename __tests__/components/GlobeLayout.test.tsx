import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const replace = vi.fn();
const startMatch = vi.fn();
const executeGlobeCommand = vi.fn();

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
  useSenecaGlobeBridge: () => ({
    handleNodeClick: vi.fn(),
    executeGlobeCommand,
  }),
}));

vi.mock('@/hooks/useSenecaThread', () => ({
  useSenecaThread: () => ({
    pendingGlobeAction: null,
    consumeGlobeAction: vi.fn(),
    isOpen: false,
    close: vi.fn(),
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

vi.mock('@/stores/senecaThreadStore', () => ({
  useSenecaThreadStore: {
    getState: () => ({
      startMatch,
    }),
  },
}));

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
  ConstellationScene: React.forwardRef((_props, _ref) => <div data-testid="scene" />),
}));

vi.mock('@/components/globe/Constellation2D', () => ({
  Constellation2D: React.forwardRef((_props, _ref) => <div data-testid="scene-2d" />),
}));

vi.mock('@/components/globe/ListOverlay', () => ({
  ListOverlay: () => <div data-testid="list-overlay" />,
}));

vi.mock('@/components/globe/WorkspaceCards', () => ({
  WorkspaceCards: () => <div data-testid="workspace-cards" />,
}));

vi.mock('@/components/governada/GlobeTooltip', () => ({
  GlobeTooltip: () => <div data-testid="globe-tooltip" />,
}));

vi.mock('@/components/globe/PanelOverlay', () => ({
  PanelOverlay: () => <div data-testid="panel-overlay" />,
}));

vi.mock('@/components/hub/EntityDetailSheet', () => ({
  EntityDetailSheet: () => <div data-testid="entity-detail-sheet" />,
}));

vi.mock('@/components/SinceLastVisit', () => ({
  SinceLastVisit: () => <div data-testid="since-last-visit" />,
}));

vi.mock('@/components/hub/DiscoveryOverlay', () => ({
  DiscoveryOverlay: () => <div data-testid="discovery-overlay" />,
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

import { GlobeLayout } from '@/components/globe/GlobeLayout';

describe('GlobeLayout deferred panels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps overlay-only panels out of the initial homepage render', async () => {
    render(<GlobeLayout />);

    await waitFor(() => expect(screen.getByTestId('scene')).toBeTruthy());
    expect(screen.queryByTestId('list-overlay')).toBeNull();
    expect(screen.queryByTestId('discovery-overlay')).toBeNull();
    expect(screen.queryByTestId('entity-detail-sheet')).toBeNull();
    expect(screen.queryByTestId('globe-tooltip')).toBeNull();

    fireEvent.keyDown(window, { key: 'l' });

    await waitFor(() => expect(screen.getByTestId('list-overlay')).toBeTruthy());
  });

  it('loads the discovery overlay only when a filter is active', async () => {
    render(<GlobeLayout initialFilter="dreps" />);

    await waitFor(() => expect(screen.getByTestId('scene')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('discovery-overlay')).toBeTruthy());
    expect(screen.queryByTestId('list-overlay')).toBeNull();
  });

  it('loads the entity detail sheet only when an entity is selected', async () => {
    render(<GlobeLayout initialEntity="drep_abc123" />);

    await waitFor(() => expect(screen.getByTestId('scene')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('entity-detail-sheet')).toBeTruthy());
    expect(screen.queryByTestId('discovery-overlay')).toBeNull();
  });
});
