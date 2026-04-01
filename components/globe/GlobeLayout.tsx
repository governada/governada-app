'use client';

/**
 * GlobeLayout — Full-viewport globe experience with Seneca thread.
 *
 * This is the client-side core of the /g/ route namespace.
 * The globe fills the viewport. Entity focus is driven by URL params.
 * SSR content from child pages is rendered as sr-only for SEO.
 *
 * Z-layer stack:
 *   z-0:  ConstellationScene (full viewport)
 *   z-20: GlobeControls (floating top-left)
 *   z-25: ListOverlay (left panel)
 *   z-30: PanelOverlay (right panel — entity detail)
 *   z-40: SenecaOrb + SenecaThread
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { ConstellationRef } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useSenecaThread } from '@/hooks/useSenecaThread';
import { useGlobeCommandListener } from '@/hooks/useGlobeCommandListener';
import { useSegment } from '@/components/providers/SegmentProvider';
// useEpochContext available via child components
import type { GlobeFilter } from '@/lib/globe/urlState';
import type { SortMode } from './FilterBar';
import type { GlobeIntent } from '@/lib/intelligence/advisor';
import { useDeviceCapability } from '@/hooks/useDeviceCapability';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';
import {
  parseEntityParam,
  encodeEntityParam,
  type EntityRef,
} from '@/lib/homepage/parseEntityParam';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { posthog } from '@/lib/posthog';
import { PanelOverlay } from './PanelOverlay';
import { ListOverlay } from './ListOverlay';
import { GlobeControls } from './GlobeControls';
import { ClusterLabels3D } from './ClusterLabels3D';
import { ClusterNebulae } from './ClusterNebula';
import { ConstellationLines } from './GlobeEdges';
import { setClusterCache } from '@/lib/globe/behaviors/clusterBehavior';
import { useFeatureFlag } from '@/components/FeatureGate';

const WorkspaceCards = dynamic(
  () => import('./WorkspaceCards').then((m) => ({ default: m.WorkspaceCards })),
  { ssr: false },
);

const GlobeTooltip = dynamic(
  () => import('@/components/governada/GlobeTooltip').then((m) => ({ default: m.GlobeTooltip })),
  { ssr: false },
);

const EntityDetailSheet = dynamic(
  () =>
    import('@/components/hub/EntityDetailSheet').then((m) => ({ default: m.EntityDetailSheet })),
  { ssr: false },
);

const SinceLastVisit = dynamic(
  () => import('@/components/SinceLastVisit').then((m) => ({ default: m.SinceLastVisit })),
  { ssr: false },
);

const DiscoveryOverlay = dynamic(
  () => import('@/components/hub/DiscoveryOverlay').then((m) => ({ default: m.DiscoveryOverlay })),
  { ssr: false },
);

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false },
);

const Constellation2D = dynamic(
  () => import('./Constellation2D').then((m) => ({ default: m.Constellation2D })),
  { ssr: false },
);

// ---------------------------------------------------------------------------
// Filter cycle order for keyboard shortcut
// ---------------------------------------------------------------------------

const FILTER_CYCLE: (GlobeFilter | null)[] = [null, 'dreps', 'proposals', 'spos', 'cc'];

interface GlobeLayoutProps {
  children?: React.ReactNode;
  /** URL params forwarded from the page (homepage deep-link support) */
  initialFilter?: string;
  initialEntity?: string;
  initialMatch?: boolean;
  initialSort?: string;
}

export function GlobeLayout({
  children,
  initialFilter,
  initialEntity,
  initialMatch,
  initialSort,
}: GlobeLayoutProps) {
  const globeRef = useRef<ConstellationRef>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seneca = useSenecaThread();
  const bridge = useSenecaGlobeBridge(globeRef);
  const { handleNodeClick: bridgeNodeClick, executeGlobeCommand } = bridge;

  // Listen for globe commands from Seneca (via centralized command bus)
  useGlobeCommandListener(bridge);

  // Cluster data for 3D labels (fetched once, flag-gated)
  const clusterFlagEnabled = useFeatureFlag('globe_alignment_layout');
  const [clusterLabels, setClusterLabels] = useState<
    Array<{
      id: string;
      name: string;
      centroid3D: [number, number, number];
      memberCount: number;
      memberIds: string[];
    }>
  >([]);
  useEffect(() => {
    if (!clusterFlagEnabled) return;
    fetch('/api/governance/constellation/clusters')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.clusters) return;
        setClusterLabels(
          data.clusters.map(
            (c: {
              id: string;
              name: string;
              centroid3D: [number, number, number];
              memberCount: number;
              memberIds: string[];
              centroid6D: number[];
            }) => ({
              id: c.id,
              name: c.name,
              centroid3D: c.centroid3D,
              memberCount: c.memberCount,
              memberIds: c.memberIds,
            }),
          ),
        );
        setClusterCache(
          data.clusters.map((c: { id: string; memberIds: string[]; centroid6D: number[] }) => ({
            id: c.id,
            memberIds: c.memberIds,
            centroid6D: c.centroid6D,
          })),
        );
      })
      .catch(() => {});
  }, [clusterFlagEnabled]);

  const { segment, drepId } = useSegment();
  const isAuthenticated = segment !== 'anonymous';
  // Epoch context available via useEpochContext() in child components
  const { use2D } = useDeviceCapability();

  // ---------------------------------------------------------------------------
  // Homepage features: user node, proposals, entity detail, tooltips, match trigger
  // ---------------------------------------------------------------------------

  const { userNode, delegationBond } = useUserConstellationNode();
  const { proposalNodes } = useConstellationProposals();

  // Entity detail sheet state (bottom sheet for entity clicks on homepage)
  const [activeEntity, setActiveEntity] = useState<EntityRef | null>(
    parseEntityParam(initialEntity),
  );

  const handleEntitySelect = useCallback(
    (entityParam: string) => {
      const parsed = parseEntityParam(entityParam);
      setActiveEntity(parsed);
      if (parsed) {
        posthog.capture('entity_selected', {
          type: parsed.type,
          id: parsed.id,
          source: 'homepage',
        });
        const nodeId =
          parsed.type === 'proposal' ? `${parsed.id}_${parsed.secondaryId}` : parsed.id;
        bridge.executeGlobeCommand({ type: 'flyTo', nodeId });
      }
    },
    [bridge],
  );

  const handleEntityClose = useCallback(() => setActiveEntity(null), []);

  // Tooltip hover state
  const [hoveredNode, setHoveredNode] = useState<ConstellationNode3D | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, pos: { x: number; y: number } | null) => {
      setHoveredNode(node);
      setHoverScreenPos(pos);
    },
    [],
  );

  // Trigger match flow from URL param on mount
  const matchTriggered = useRef(false);
  useEffect(() => {
    if (initialMatch && !matchTriggered.current) {
      matchTriggered.current = true;
      useSenecaThreadStore.getState().startMatch();
    }
  }, [initialMatch]);

  // SinceLastVisit state (auth only)
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  // drepId already destructured from useSegment() above
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthenticated) return;
    const ts = localStorage.getItem('drepscore_last_visit');
    if (ts) setPreviousVisitAt(new Date(Number(ts)).toISOString());
  }, [isAuthenticated]);

  // Funnel tracking for anonymous users
  useEffect(() => {
    if (!isAuthenticated) {
      trackFunnel(FUNNEL_EVENTS.LANDING_VIEWED);
    }
  }, [isAuthenticated]);

  // ---------------------------------------------------------------------------
  // List overlay state
  // ---------------------------------------------------------------------------

  const urlFilter = (searchParams.get('filter') ?? initialFilter ?? null) as GlobeFilter | null;
  const [listOpen, setListOpen] = useState(!!urlFilter);
  const [filter, setFilter] = useState<GlobeFilter | null>(urlFilter);
  const [sort, setSort] = useState<SortMode>('score');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [workspaceCardsVisible, setWorkspaceCardsVisible] = useState(false);

  // Sync filter from URL on navigation
  useEffect(() => {
    const f = searchParams.get('filter') as GlobeFilter | null;
    if (f && f !== filter) {
      setFilter(f);
      setListOpen(true);
    }
  }, [searchParams, filter]);

  // ---------------------------------------------------------------------------
  // Globe focus tracking
  // ---------------------------------------------------------------------------

  const initialFocusDone = useRef(false);

  const handleGlobeReady = useCallback(() => {
    if (initialFocusDone.current) return;
    initialFocusDone.current = true;
    const entityFocus = deriveEntityFocusFromPath(pathname);
    if (entityFocus) {
      globeRef.current?.flyToNode(entityFocus);
    }
  }, [pathname]);

  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      bridgeNodeClick(node);
      // On homepage (/), open entity detail sheet instead of navigating to /g/ route
      if (pathname === '/') {
        const nodeType = node.nodeType ?? 'drep';
        let entityParam: string;
        if (nodeType === 'proposal') {
          const lastUnderscore = node.id.lastIndexOf('_');
          if (lastUnderscore > 0) {
            entityParam = encodeEntityParam(
              'proposal',
              node.id.slice(0, lastUnderscore),
              node.id.slice(lastUnderscore + 1),
            );
          } else {
            entityParam = encodeEntityParam('proposal', node.id, '0');
          }
        } else if (nodeType === 'cc') {
          entityParam = encodeEntityParam('cc', node.id);
        } else if (nodeType === 'spo') {
          entityParam = encodeEntityParam('pool', node.id);
        } else {
          entityParam = encodeEntityParam('drep', node.id);
        }
        handleEntitySelect(entityParam);
      } else {
        const route = nodeToRoute(node);
        if (route) router.push(route);
      }
    },
    [router, bridgeNodeClick, pathname, handleEntitySelect],
  );

  const handlePanelClose = useCallback(() => {
    globeRef.current?.resetCamera();
  }, []);

  // Reset initial focus on path changes
  useEffect(() => {
    initialFocusDone.current = false;
    const entityFocus = deriveEntityFocusFromPath(pathname);
    if (entityFocus && globeRef.current) {
      globeRef.current.flyToNode(entityFocus);
      initialFocusDone.current = true;
    }
  }, [pathname]);

  // ---------------------------------------------------------------------------
  // List ↔ Globe sync: hover highlight
  // ---------------------------------------------------------------------------

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHighlightedNodeId(nodeId);
    globeRef.current?.highlightNode(nodeId);
  }, []);

  // ---------------------------------------------------------------------------
  // List overlay controls
  // ---------------------------------------------------------------------------

  const handleFilterChange = useCallback(
    (newFilter: GlobeFilter | null) => {
      setFilter(newFilter);
      // Update URL without navigation
      const params = new URLSearchParams(searchParams.toString());
      if (newFilter) {
        params.set('filter', newFilter);
      } else {
        params.delete('filter');
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const handleToggleList = useCallback(() => {
    setListOpen((prev) => !prev);
  }, []);

  const handleCycleFilter = useCallback(() => {
    const idx = FILTER_CYCLE.indexOf(filter);
    const next = FILTER_CYCLE[(idx + 1) % FILTER_CYCLE.length];
    handleFilterChange(next);
    if (next && !listOpen) setListOpen(true);
  }, [filter, listOpen, handleFilterChange]);

  const handleResetGlobe = useCallback(() => {
    globeRef.current?.resetCamera();
    setListOpen(false);
    handleFilterChange(null);
    router.push('/g');
  }, [router, handleFilterChange]);

  const handleListClose = useCallback(() => {
    setListOpen(false);
    // Clear highlight when list closes
    globeRef.current?.highlightNode(null);
    setHighlightedNodeId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleToggleList();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleCycleFilter();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToggleList, handleCycleFilter]);

  // ---------------------------------------------------------------------------
  // Seneca intent → Globe dispatch
  // ---------------------------------------------------------------------------

  const consumeGlobeAction = seneca.consumeGlobeAction;

  const dispatchIntent = useCallback(
    (intent: GlobeIntent) => {
      const globe = globeRef.current;

      switch (intent.type) {
        case 'browse':
          // Open list overlay with the requested filter
          if (intent.filter) {
            handleFilterChange(intent.filter);
            setListOpen(true);
          }
          break;

        case 'focus':
          // Fly to entity and navigate to its detail route
          if (intent.entityId && intent.entityType) {
            const nodeId = `${intent.entityType}_${intent.entityId}`;
            globe?.flyToNode(nodeId);
            // Navigate to the entity's /g/ route for the panel
            const route = intentEntityRoute(intent.entityType, intent.entityId);
            if (route) router.push(route);
          }
          break;

        case 'compare':
          // For now, open list with all entities visible — AI handles comparison in response
          // Future: highlight two specific nodes
          break;

        case 'filter':
          if (intent.filter) {
            handleFilterChange(intent.filter);
            setListOpen(true);
          }
          break;

        case 'votesplit':
          if (intent.proposalRef) {
            executeGlobeCommand({ type: 'voteSplit', proposalRef: intent.proposalRef });
          }
          break;

        case 'temporal':
          if (intent.epoch != null) {
            // Update URL with temporal epoch
            const params = new URLSearchParams(searchParams.toString());
            params.set('t', String(intent.epoch));
            params.set('view', 'temporal');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }
          break;

        case 'reset':
          handleResetGlobe();
          setWorkspaceCardsVisible(false);
          break;

        case 'workspace':
          // Choreograph globe: warm proposals topic + show workspace cards
          executeGlobeCommand({ type: 'warmTopic', topic: 'proposals' });
          setWorkspaceCardsVisible(true);
          break;
      }
    },
    [handleFilterChange, handleResetGlobe, executeGlobeCommand, router, pathname, searchParams],
  );

  // Watch for pending globe actions from Seneca
  useEffect(() => {
    const action = seneca.pendingGlobeAction;
    if (action) {
      dispatchIntent(action);
      consumeGlobeAction();
    }
  }, [seneca.pendingGlobeAction, dispatchIntent, consumeGlobeAction]);

  // Globe commands from Seneca already handled by useGlobeCommandListener above

  // ---------------------------------------------------------------------------
  // Seneca whisper
  // ---------------------------------------------------------------------------

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {/* Full-viewport constellation — z-0 */}
      <div className="absolute inset-0 z-0">
        {use2D ? (
          <Constellation2D
            ref={globeRef}
            interactive
            className="w-full h-full"
            onReady={handleGlobeReady}
            onNodeSelect={handleNodeSelect}
            breathing
          />
        ) : (
          <ConstellationScene
            ref={globeRef}
            interactive
            className="w-full h-full"
            onReady={handleGlobeReady}
            onNodeSelect={handleNodeSelect}
            onNodeHoverScreen={handleNodeHoverScreen}
            breathing
            userNode={userNode}
            proposalNodes={proposalNodes}
            delegationBond={delegationBond}
            clusters={clusterLabels}
          >
            {clusterLabels.length > 0 && (
              <>
                <ClusterLabels3D clusters={clusterLabels} />
                <ClusterNebulae clusters={clusterLabels} />
              </>
            )}
          </ConstellationScene>
        )}
      </div>

      {/* Cluster labels moved inside Canvas as children of ConstellationScene */}

      {/* SSR content for SEO — hidden from visual users */}
      <div className="sr-only" aria-label="Governance entity details">
        {children}
      </div>

      {/* Globe controls — z-20: floating top-left */}
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        <GlobeControls
          listOpen={listOpen}
          onToggleList={handleToggleList}
          activeFilter={filter}
          onCycleFilter={handleCycleFilter}
          onResetGlobe={handleResetGlobe}
        />
      </div>

      {/* List overlay — z-25: left side panel */}
      <ListOverlay
        isOpen={listOpen}
        onClose={handleListClose}
        filter={filter}
        onFilterChange={handleFilterChange}
        sort={sort}
        onSortChange={setSort}
        highlightedNodeId={highlightedNodeId}
        onNodeHover={handleNodeHover}
      />

      {/* Workspace cards overlay — z-28 */}
      {workspaceCardsVisible && <WorkspaceCards onClose={() => setWorkspaceCardsVisible(false)} />}

      {/* Panel overlay — z-30: entity detail panels over the globe */}
      <PanelOverlay
        onClose={handlePanelClose}
        collapsed={seneca.isOpen}
        onExpand={() => seneca.close()}
      />

      {/* Cursor-following tooltip */}
      <GlobeTooltip node={hoveredNode} screenPos={hoverScreenPos} showMatchCta={!isAuthenticated} />

      {/* Entity detail sheet — bottom sheet for entity clicks on homepage */}
      <EntityDetailSheet entity={activeEntity} onClose={handleEntityClose} />

      {/* Discovery overlay — filter-driven entity list */}
      <DiscoveryOverlay
        filter={filter}
        initialSort={initialSort}
        onEntitySelect={handleEntitySelect}
        onClose={() => {
          setFilter(null);
          bridge.executeGlobeCommand({ type: 'clear' });
        }}
      />

      {/* Since last visit — compact activity summary for returning authenticated users */}
      {previousVisitAt && isAuthenticated && (
        <div className="fixed bottom-[calc(theme(spacing.6)+14rem)] left-6 z-40 w-[min(440px,calc(100vw-3rem))] max-md:bottom-[calc(14rem)] max-md:left-4 max-md:right-4 max-md:w-auto">
          <SinceLastVisit previousVisitAt={previousVisitAt} delegatedDrepId={drepId} />
        </div>
      )}

      {/* Seneca companion provided by GovernadaShell (app-wide) — no duplication here */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a globe node ID from the current /g/ route path */
function deriveEntityFocusFromPath(pathname: string): string | null {
  const drepMatch = pathname.match(/^\/g\/drep\/([^/]+)/);
  if (drepMatch) return `drep_${decodeURIComponent(drepMatch[1])}`;

  const proposalMatch = pathname.match(/^\/g\/proposal\/([a-f0-9]+)\/(\d+)/);
  if (proposalMatch) return `proposal_${proposalMatch[1]}_${proposalMatch[2]}`;

  const poolMatch = pathname.match(/^\/g\/pool\/([^/]+)/);
  if (poolMatch) return `spo_${decodeURIComponent(poolMatch[1])}`;

  const ccMatch = pathname.match(/^\/g\/cc\/([^/]+)/);
  if (ccMatch) return `cc_${decodeURIComponent(ccMatch[1])}`;

  return null;
}

/** Map an intent entity type + id to a /g/ route */
function intentEntityRoute(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'drep':
      return `/g/drep/${encodeURIComponent(entityId)}`;
    case 'pool':
    case 'spo':
      return `/g/pool/${encodeURIComponent(entityId)}`;
    case 'cc':
      return `/g/cc/${encodeURIComponent(entityId)}`;
    case 'proposal':
      // For proposals, entityId might be "txHash_index" or just "txHash"
      if (entityId.includes('_')) {
        const lastUnderscore = entityId.lastIndexOf('_');
        const txHash = entityId.slice(0, lastUnderscore);
        const index = entityId.slice(lastUnderscore + 1);
        return `/g/proposal/${txHash}/${index}`;
      }
      return `/g/proposal/${entityId}/0`;
    default:
      return null;
  }
}

/** Map a constellation node to its /g/ route */
function nodeToRoute(node: ConstellationNode3D): string | null {
  switch (node.nodeType) {
    case 'drep':
      return `/g/drep/${encodeURIComponent(node.fullId || node.id)}`;
    case 'proposal': {
      const lastUnderscore = node.fullId.lastIndexOf('_');
      if (lastUnderscore === -1) return `/g/proposal/${node.fullId}/0`;
      const txHash = node.fullId.slice(0, lastUnderscore);
      const index = node.fullId.slice(lastUnderscore + 1);
      return `/g/proposal/${txHash}/${index}`;
    }
    case 'spo':
      return `/g/pool/${encodeURIComponent(node.fullId || node.id)}`;
    case 'cc':
      return `/g/cc/${encodeURIComponent(node.fullId || node.id)}`;
    default:
      return null;
  }
}
