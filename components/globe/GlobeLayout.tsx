'use client';

/**
 * GlobeLayout â€” Full-viewport globe experience with Seneca thread.
 *
 * This is the client-side core of the /g/ route namespace.
 * The globe fills the viewport. Entity focus is driven by URL params.
 * SSR content from child pages is rendered as sr-only for SEO.
 *
 * Z-layer stack:
 *   z-0:  ConstellationScene (full viewport)
 *   z-20: GlobeControls (floating top-left)
 *   z-25: ListOverlay (left panel)
 *   z-30: PanelOverlay (right panel â€” entity detail)
 *   z-40: SenecaOrb + SenecaThread
 */

import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMutation } from '@tanstack/react-query';
import type { ConstellationRef } from '@/lib/globe/types';
import type { ConstellationApiData, ConstellationNode3D } from '@/lib/constellation/types';
import { useGovernanceConstellation } from '@/hooks/queries';
import { computeGlobeLayout } from '@/lib/constellation/globe-layout';
import {
  CONSTELLATION_NODE_LIMITS,
  hasPrecomputedConstellationNodes,
  limitPrecomputedConstellationNodes,
} from '@/lib/constellation/sceneNodes';
import { useSenecaGlobeBridge } from '@/hooks/useSenecaGlobeBridge';
import { useSenecaThread } from '@/hooks/useSenecaThread';
import { useGlobeCommandListener } from '@/hooks/useGlobeCommandListener';
import {
  CLUSTER_LINGER_MS,
  CAMERA_IDLE_MS,
  MOUSE_IDLE_MS,
  isClusterWhisperCoolingDown,
  useCameraIdle,
} from '@/hooks/useCameraIdle';
import { useSegment } from '@/components/providers/SegmentProvider';
// useEpochContext available via child components
import type { GlobeFilter } from '@/lib/globe/urlState';
import type { SortMode } from './FilterBar';
import type { GlobeIntent } from '@/lib/intelligence/advisor';
import { useDeviceCapability } from '@/hooks/useDeviceCapability';
import { useUserConstellationNode } from '@/hooks/useUserConstellationNode';
import { useConstellationProposals } from '@/hooks/useConstellationProposals';
import {
  parseEntityParam,
  encodeEntityParam,
  type EntityRef,
} from '@/lib/homepage/parseEntityParam';
import { trackFunnel, FUNNEL_EVENTS } from '@/lib/funnel';
import { posthog } from '@/lib/posthog';
import {
  dispatchCinematicExit,
  dispatchCinematicState,
  resolveCinematicPayload,
} from '@/lib/globe/cinematicDispatcher';
import { ListOverlay } from './ListOverlay';
import { GlobeControls } from './GlobeControls';
import { ClusterLabels3D } from './ClusterLabels3D';
import { ClusterNebulae } from './ClusterNebula';
import { setClusterCache } from '@/lib/globe/behaviors/clusterBehavior';
import { getSharedIntent, setSharedIntent } from '@/lib/globe/focusIntent';
import { useFeatureFlag } from '@/components/FeatureGate';
import { STORAGE_KEYS, readStoredValue } from '@/lib/persistence';
import { useMotionStrength } from '@/lib/motion/motionStrength';
import {
  AnchoredCardLayer,
  AnchoredCardMobileStack,
  type AnchoredCardDescriptor,
  type FoldedAnchoredCardEntry,
} from '@/components/globe/AnchoredCard';
import { useIsTouchDevice, useViewportClass } from '@/hooks/useViewportClass';
import { captureSenecaInteraction } from '@/lib/seneca/telemetry';
import { captureHomepageTiming } from '@/lib/telemetry/perfMarks';
import type { HoverDetailLevel } from '@/components/governada/GlobeTooltip';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';

const WorkspaceCards = dynamic(
  () => import('./WorkspaceCards').then((m) => ({ default: m.WorkspaceCards })),
  { ssr: false },
);

const GlobeTooltip = dynamic(
  () => import('@/components/governada/GlobeTooltip').then((m) => ({ default: m.GlobeTooltip })),
  { ssr: false },
);

const PanelOverlay = dynamic(
  () => import('./PanelOverlay').then((m) => ({ default: m.PanelOverlay })),
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
const LAYER2_ACTIVE_STATES = new Set(['returning_quiet', 'returning_in_session']);
// 3D constellation world units; beyond this the camera is not credibly over a cluster.
const MAX_CLUSTER_TARGET_DISTANCE = 4;

export function isLayer2CinematicStateEnabled(state: string | null | undefined) {
  return LAYER2_ACTIVE_STATES.has(state ?? '');
}

interface ClusterLabel {
  id: string;
  name: string;
  centroid3D: [number, number, number];
  centroid6D: number[];
  memberCount: number;
  memberIds: string[];
  dominantDimension?: string;
}

interface GlobeLayoutProps {
  children?: React.ReactNode;
  /** URL params forwarded from the page (homepage deep-link support) */
  initialFilter?: string;
  initialEntity?: string;
  initialSort?: string;
}

export function GlobeLayout({
  children,
  initialFilter,
  initialEntity,
  initialSort,
}: GlobeLayoutProps) {
  const globeRef = useRef<ConstellationRef>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seneca = useSenecaThread();
  const [anchoredCards, setAnchoredCards] = useState<AnchoredCardDescriptor[]>([]);
  const setHomepageAnchoredCards = useSenecaThreadStore((s) => s.setHomepageAnchoredCards);
  const [, setFoldedAnchoredCards] = useState<FoldedAnchoredCardEntry[]>([]);
  const surfacedAnchoredCardIds = useRef<Set<string>>(new Set());
  const hoverPreviewSeenIds = useRef<Set<string>>(new Set());
  const tapPreviewSeenIds = useRef<Set<string>>(new Set());
  const didTrackInteractive = useRef(false);
  const handleAnchoredCards = useCallback((cards: AnchoredCardDescriptor[]) => {
    // The prioritization engine yields one primary surface at a time; this keeps
    // card kinds homogeneous instead of mixing delta/action/sentiment cards.
    setAnchoredCards(cards);
    for (const card of cards) {
      if (surfacedAnchoredCardIds.current.has(card.id)) continue;
      surfacedAnchoredCardIds.current.add(card.id);
      // PostHog payload: { id, kind, anchorNodeId, autoDismissMs }.
      posthog.capture('anchored_card_surfaced', {
        id: card.id,
        kind: card.kind,
        anchorNodeId: card.anchorNodeId,
        autoDismissMs: card.autoDismissMs ?? null,
      });
    }
  }, []);
  const handleFoldAnchoredCard = useCallback((entry: FoldedAnchoredCardEntry) => {
    setAnchoredCards((current) => current.filter((card) => card.id !== entry.id));
    setFoldedAnchoredCards((current) => [...current.filter((card) => card.id !== entry.id), entry]);
    // PostHog payload: { id, kind, reason }.
    posthog.capture('anchored_card_dismissed', {
      id: entry.id,
      kind: entry.kind,
      reason: entry.reason,
    });
  }, []);
  const bridgeOptions = useMemo(
    () => ({
      onAnchoredCards: handleAnchoredCards,
      onFoldAnchoredCard: handleFoldAnchoredCard,
    }),
    [handleAnchoredCards, handleFoldAnchoredCard],
  );
  const bridge = useSenecaGlobeBridge(globeRef, bridgeOptions);
  const { handleNodeClick: bridgeNodeClick, executeGlobeCommand } = bridge;

  useEffect(() => {
    setHomepageAnchoredCards(anchoredCards);
  }, [anchoredCards, setHomepageAnchoredCards]);

  useEffect(() => {
    return () => setHomepageAnchoredCards([]);
  }, [setHomepageAnchoredCards]);
  const motionStrength = useMotionStrength();
  const viewportClass = useViewportClass();
  const isTouchDevice = useIsTouchDevice();
  const lastHomepageCinemaKey = useRef<string | null>(null);
  const activeHomepageCinema = useRef<{
    key: string;
    state: Parameters<typeof dispatchCinematicExit>[0];
  } | null>(null);

  // Listen for globe commands from Seneca (via centralized command bus)
  useGlobeCommandListener(bridge);

  // Cluster data for 3D labels (fetched once, flag-gated)
  const clusterFlagEnabled = useFeatureFlag('globe_alignment_layout');
  const [clusterLabels, setClusterLabels] = useState<ClusterLabel[]>([]);
  useEffect(() => {
    if (!clusterFlagEnabled) return;
    fetch('/api/governance/constellation/clusters')
      .then((r) => {
        if (!r.ok) {
          throw Object.assign(new Error(`Cluster fetch failed with status ${r.status}`), {
            statusCode: r.status,
          });
        }
        return r.json();
      })
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
              dominantDimension: string;
            }) => ({
              id: c.id,
              name: c.name,
              centroid3D: c.centroid3D,
              centroid6D: c.centroid6D,
              memberCount: c.memberCount,
              memberIds: c.memberIds,
              dominantDimension: c.dominantDimension,
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
      .catch((error) => {
        // PostHog payload: { error, statusCode }.
        posthog.capture('cluster_fetch_failed', {
          error: getErrorMessage(error),
          statusCode: getStatusCode(error),
        });
      });
  }, [clusterFlagEnabled]);

  const { segment, drepId } = useSegment();
  const isAuthenticated = segment !== 'anonymous';
  // Epoch context available via useEpochContext() in child components
  const { use2D, gpuTier } = useDeviceCapability();

  // ---------------------------------------------------------------------------
  // Homepage features: user node, proposals, entity detail, tooltips, match trigger
  // ---------------------------------------------------------------------------

  const { userNode, delegationBond } = useUserConstellationNode();
  const { proposalNodes } = useConstellationProposals();
  const { data: constellationData } = useGovernanceConstellation();

  const anchoredNodePositions = useMemo(() => {
    const positions = new Map<string, [number, number, number]>();
    if (constellationData) {
      const typedData = constellationData as ConstellationApiData;
      const baseNodes = hasPrecomputedConstellationNodes(typedData.nodes)
        ? limitPrecomputedConstellationNodes(typedData.nodes, gpuTier)
        : computeGlobeLayout(typedData.nodes, CONSTELLATION_NODE_LIMITS[gpuTier]).nodes;
      for (const node of baseNodes) {
        positions.set(node.id, node.position);
        positions.set(node.fullId, node.position);
      }
    }
    for (const node of proposalNodes) {
      positions.set(node.id, node.position);
      positions.set(node.fullId, node.position);
    }
    if (userNode) {
      positions.set(userNode.id, userNode.position);
      positions.set(userNode.fullId, userNode.position);
    }
    return positions;
  }, [constellationData, gpuTier, proposalNodes, userNode]);

  // Entity detail sheet state (bottom sheet for entity clicks on homepage)
  const [activeEntity, setActiveEntity] = useState<EntityRef | null>(
    parseEntityParam(initialEntity),
  );

  const handleEntitySelect = useCallback(
    (entityParam: string) => {
      const parsed = parseEntityParam(entityParam);
      setActiveEntity(parsed);
      if (parsed) {
        const entityPayload = {
          type: parsed.type,
          id: parsed.id,
          source: 'homepage',
        };
        posthog.capture('entity_selected', entityPayload);
        // Phase 0: dual-emit during entity_inspected naming transition
        posthog.capture('entity_inspected', entityPayload);
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
  const [previewedNodeId, setPreviewedNodeId] = useState<string | null>(null);
  const [previewExpiresAt, setPreviewExpiresAt] = useState<number | null>(null);
  const [anchoredCardEngagement, setAnchoredCardEngagement] = useState<{
    nodeId: string | null;
    key: number;
  }>({ nodeId: null, key: 0 });
  const lastTouchSelectRef = useRef<{ nodeId: string; at: number } | null>(null);
  const [hoverDetailLevel, setHoverDetailLevel] = useState<HoverDetailLevel>('overview');

  const handleNodeHoverScreen = useCallback(
    (node: ConstellationNode3D | null, pos: { x: number; y: number } | null) => {
      if (isTouchDevice) return;
      setHoveredNode(node);
      setHoverScreenPos(pos);
      if (node) {
        const nodeType = node.nodeType ?? 'drep';
        const detailLevel =
          nodeType === 'drep' ? deriveHoverDetailLevel(globeRef.current) : 'overview';
        if (nodeType === 'drep') {
          setHoverDetailLevel(detailLevel);
        }
        const hoverKey = `${nodeType}:${node.fullId || node.id}`;
        if (!hoverPreviewSeenIds.current.has(hoverKey)) {
          hoverPreviewSeenIds.current.add(hoverKey);
          // PostHog payload: { nodeId, nodeType, detailLevel }.
          posthog.capture('hover_preview_shown', {
            nodeId: node.fullId || node.id,
            nodeType,
            detailLevel,
          });
        }
      }
    },
    [isTouchDevice],
  );

  const bumpAnchoredCardTimer = useCallback((nodeId: string) => {
    setAnchoredCardEngagement((current) => ({ nodeId, key: current.key + 1 }));
  }, []);

  const handleTouchNodePreview = useCallback(
    (node: ConstellationNode3D) => {
      // TODO(Phase 5): compose the 350ms match-candidate long-press preview with this touch branch.
      const now = Date.now();
      const nodeId = node.id;
      if (
        lastTouchSelectRef.current?.nodeId === nodeId &&
        now - lastTouchSelectRef.current.at < 250
      ) {
        return;
      }
      lastTouchSelectRef.current = { nodeId, at: now };

      const samePreviewActive =
        previewedNodeId === nodeId && previewExpiresAt !== null && now < previewExpiresAt;
      const hasAnchoredCard = anchoredCards.some(
        (card) => card.anchorNodeId === node.id || card.anchorNodeId === node.fullId,
      );

      if (samePreviewActive) {
        posthog.capture('tap_preview_completed', {
          nodeId,
          nodeType: node.nodeType ?? 'drep',
          viewport: viewportClass,
        });
        if (hasAnchoredCard) bumpAnchoredCardTimer(node.id);
        const entityParam = nodeToEntityParam(node);
        if (entityParam) handleEntitySelect(entityParam);
        setPreviewedNodeId(null);
        setPreviewExpiresAt(null);
        setHoveredNode(null);
        setHoverScreenPos(null);
        return;
      }

      setPreviewedNodeId(nodeId);
      setPreviewExpiresAt(now + 5_000);
      if (!tapPreviewSeenIds.current.has(nodeId)) {
        tapPreviewSeenIds.current.add(nodeId);
        // PostHog payload: { nodeId, nodeType, viewport }.
        posthog.capture('tap_preview_shown', {
          nodeId,
          nodeType: node.nodeType ?? 'drep',
          viewport: viewportClass,
        });
      }
      setSharedIntent({
        focusedIds: new Set([node.id]),
        intensities: new Map([[node.id, 1]]),
        dimStrength: 0.7,
        flyToFocus: false,
        cameraProximity: 'locked',
        focusColor: '#fbbf24',
        focusSizeBoost: 1.25,
        transitionDuration: 0.25,
      });

      if (hasAnchoredCard) {
        bumpAnchoredCardTimer(node.id);
        setHoveredNode(null);
        setHoverScreenPos(null);
        return;
      }

      setHoveredNode(node);
      setHoverScreenPos(getTouchPreviewPosition());
    },
    [
      anchoredCards,
      bumpAnchoredCardTimer,
      handleEntitySelect,
      previewExpiresAt,
      previewedNodeId,
      viewportClass,
    ],
  );

  useEffect(() => {
    if (!previewedNodeId || previewExpiresAt === null) return;
    const delay = Math.max(0, previewExpiresAt - Date.now());
    const timeout = setTimeout(() => {
      setPreviewedNodeId(null);
      setPreviewExpiresAt(null);
      setHoveredNode(null);
      setHoverScreenPos(null);
      setSharedIntent({ focusedIds: null });
    }, delay);
    return () => clearTimeout(timeout);
  }, [previewExpiresAt, previewedNodeId]);

  // SinceLastVisit state (auth only)
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  // drepId already destructured from useSegment() above
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthenticated) return;
    const ts = readStoredValue(STORAGE_KEYS.lastVisit);
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
  // ListOverlay is only opened explicitly via keyboard shortcut (L) or GlobeControls button.
  // DiscoveryOverlay handles all filter-driven browsing from URL params.
  // Previously, both opened simultaneously on ?filter= navigation, creating duplicate panels.
  const [listOpen, setListOpen] = useState(false);
  const [filter, setFilter] = useState<GlobeFilter | null>(urlFilter);
  const [sort, setSort] = useState<SortMode>('score');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [workspaceCardsVisible, setWorkspaceCardsVisible] = useState(false);

  // Sync filter from URL on navigation â€” only update filter state, don't force list open
  useEffect(() => {
    const f = searchParams.get('filter') as GlobeFilter | null;
    if (f && f !== filter) {
      setFilter(f);
    }
  }, [searchParams, filter]);

  // ---------------------------------------------------------------------------
  // Globe focus tracking
  // ---------------------------------------------------------------------------

  const initialFocusDone = useRef(false);

  const handleGlobeReady = useCallback(() => {
    if (pathname === '/' && !didTrackInteractive.current) {
      didTrackInteractive.current = true;
      const emitInteractive = () =>
        captureHomepageTiming('time_to_interactive', { viewport: viewportClass });
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(emitInteractive);
      } else {
        emitInteractive();
      }
    }
    if (initialFocusDone.current) return;
    initialFocusDone.current = true;
    const entityFocus = deriveEntityFocusFromPath(pathname);
    if (entityFocus) {
      globeRef.current?.flyToNode(entityFocus);
    }
  }, [pathname, viewportClass]);

  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      if (isTouchDevice) {
        handleTouchNodePreview(node);
        return;
      }

      bridgeNodeClick(node);
      // On homepage (/), open entity detail sheet instead of navigating to /g/ route
      if (pathname === '/') {
        const entityParam = nodeToEntityParam(node);
        handleEntitySelect(entityParam);
      } else {
        const route = nodeToRoute(node);
        if (route) router.push(route);
      }
    },
    [router, bridgeNodeClick, pathname, handleEntitySelect, isTouchDevice, handleTouchNodePreview],
  );

  const handleAnchoredCardSelect = useCallback(
    (card: AnchoredCardDescriptor) => {
      posthog.capture('anchored_card_selected', {
        id: card.id,
        kind: card.kind,
        anchorNodeId: card.anchorNodeId,
      });
      bumpAnchoredCardTimer(card.anchorNodeId);
      const entityParam = cardToEntityParam(card);
      if (entityParam) handleEntitySelect(entityParam);
    },
    [bumpAnchoredCardTimer, handleEntitySelect],
  );

  const handlePanelClose = useCallback(() => {
    globeRef.current?.resetCamera();
  }, []);
  const showRoutePanel = pathname.startsWith('/g/');

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
  // List â†” Globe sync: hover highlight
  // ---------------------------------------------------------------------------

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHighlightedNodeId(nodeId);
    globeRef.current?.highlightNode(nodeId);
  }, []);

  // ---------------------------------------------------------------------------
  // Layer 2 idle drift + region-aware Seneca whisper
  // ---------------------------------------------------------------------------

  const cameraIdle = useCameraIdle({ mouseIdleMs: MOUSE_IDLE_MS, cameraIdleMs: CAMERA_IDLE_MS });
  const cinematicState = seneca.homepageCinematic?.queue.primary.state;
  const layer2Enabled = isLayer2CinematicStateEnabled(cinematicState);
  const shouldShowHoverTooltip = !cinematicState || layer2Enabled;
  const senecaIsOpen = seneca.isOpen;
  const regionWhisperClusterId = seneca.regionSuggestionWhisper?.clusterId ?? null;
  const homepageIdentity = seneca.homepageCinematic?.identity;
  const setRegionSuggestionWhisper = seneca.setRegionSuggestionWhisper;
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lingerClusterRef = useRef<string | null>(null);
  const driftActiveRef = useRef(false);

  const { mutate: requestRegionSuggestion, isPending: regionSuggestionPending } = useMutation({
    mutationFn: async ({
      clusterId,
      userContextRef,
    }: {
      clusterId: string;
      userContextRef: string;
    }) => {
      const response = await fetch('/api/seneca/region-suggestion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clusterId, userContextRef }),
      });
      if (!response.ok) throw new Error('Failed to fetch region suggestion');
      return response.json() as Promise<{
        suggestion: string;
        windowDays?: number | string | null;
      }>;
    },
    onSuccess: (data, variables) => {
      if (!data.suggestion) return;
      setRegionSuggestionWhisper({ clusterId: variables.clusterId, text: data.suggestion });
      captureSenecaInteraction({
        kind: 'region_suggestion_shown',
        clusterId: variables.clusterId,
        dismissed: false,
      });
    },
  });

  useEffect(() => {
    const clearLingerTimer = () => {
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
      lingerClusterRef.current = null;
    };

    const stopDrift = () => {
      if (!driftActiveRef.current) return;
      driftActiveRef.current = false;
      executeGlobeCommand({
        type: 'cinematic',
        state: { orbitSpeed: 0, transitionDuration: 0.8 },
      });
    };

    if (!cameraIdle || !layer2Enabled || motionStrength === 0 || senecaIsOpen) {
      clearLingerTimer();
      stopDrift();
      return clearLingerTimer;
    }

    if (!driftActiveRef.current) {
      driftActiveRef.current = true;
      executeGlobeCommand({ type: 'drift', motionStrength });
    }

    const snapshot = globeRef.current?.getCameraSnapshot();
    const closestCluster = snapshot
      ? findClosestCameraCluster(snapshot.target, clusterLabels)
      : null;

    if (!closestCluster || isClusterWhisperCoolingDown(closestCluster.id)) {
      clearLingerTimer();
      return clearLingerTimer;
    }

    if (
      lingerClusterRef.current === closestCluster.id ||
      regionSuggestionPending ||
      regionWhisperClusterId === closestCluster.id
    ) {
      return clearLingerTimer;
    }

    clearLingerTimer();
    lingerClusterRef.current = closestCluster.id;
    lingerTimerRef.current = setTimeout(() => {
      const userContextRef =
        homepageIdentity?.userId ?? homepageIdentity?.stakeAddress ?? 'anonymous';
      requestRegionSuggestion({ clusterId: closestCluster.id, userContextRef });
    }, CLUSTER_LINGER_MS);

    return clearLingerTimer;
  }, [
    cameraIdle,
    clusterLabels,
    executeGlobeCommand,
    layer2Enabled,
    motionStrength,
    homepageIdentity,
    regionSuggestionPending,
    regionWhisperClusterId,
    requestRegionSuggestion,
    senecaIsOpen,
  ]);

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
  // Seneca intent â†’ Globe dispatch
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
          // For now, open list with all entities visible â€” AI handles comparison in response
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

  useEffect(() => {
    const snapshot = seneca.homepageCinematic;
    if (!snapshot) {
      if (activeHomepageCinema.current) {
        dispatchCinematicExit(activeHomepageCinema.current.state, {
          dispatch: executeGlobeCommand,
          baseMotionStrength: motionStrength,
        });
      }
      activeHomepageCinema.current = null;
      lastHomepageCinemaKey.current = null;
      return;
    }

    const key = `${snapshot.queue.primary.id}:${snapshot.queue.primary.state}:${snapshot.queue.meta.reasoning}`;
    if (lastHomepageCinemaKey.current === key && activeHomepageCinema.current?.key === key) return;

    if (activeHomepageCinema.current) {
      dispatchCinematicExit(activeHomepageCinema.current.state, {
        dispatch: executeGlobeCommand,
        baseMotionStrength: motionStrength,
        interruptionReason: snapshot.queue.primary.tier === 0 ? 'tier_0_supersede' : 'user_input',
      });
    }

    lastHomepageCinemaKey.current = key;
    let cancelled = false;

    void resolveCinematicPayload(snapshot.queue.primary.state, snapshot.queue.primary.payload).then(
      (payload) => {
        if (cancelled) return;
        captureHomepageTiming('time_to_cinema_fire', { state: snapshot.queue.primary.state });
        dispatchCinematicState(snapshot.queue.primary.state, payload, {
          dispatch: executeGlobeCommand,
          item: snapshot.queue.primary,
          meta: snapshot.queue.meta,
          baseMotionStrength: motionStrength,
        });
        activeHomepageCinema.current = { key, state: snapshot.queue.primary.state };
      },
    );

    return () => {
      cancelled = true;
    };
  }, [executeGlobeCommand, motionStrength, seneca.homepageCinematic]);

  // ---------------------------------------------------------------------------
  // Seneca whisper
  // ---------------------------------------------------------------------------

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
      {/* Full-viewport constellation â€” z-0 */}
      <div className="absolute inset-0 z-0">
        {use2D ? (
          <Constellation2D
            ref={globeRef}
            interactive
            className="w-full h-full"
            onReady={handleGlobeReady}
            onNodeSelect={handleNodeSelect}
            breathing
            motionStrength={motionStrength}
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
            motionStrength={motionStrength}
          >
            {clusterLabels.length > 0 && (
              <>
                <ClusterLabels3D clusters={clusterLabels} />
                <ClusterNebulae clusters={clusterLabels} />
              </>
            )}
            <AnchoredCardLayer
              cards={anchoredCards}
              nodePositions={anchoredNodePositions}
              onFold={handleFoldAnchoredCard}
              engagedAnchorNodeId={anchoredCardEngagement.nodeId}
              engagementKey={anchoredCardEngagement.key}
            />
          </ConstellationScene>
        )}
      </div>

      <AnchoredCardMobileStack
        cards={anchoredCards}
        onFold={handleFoldAnchoredCard}
        onSelect={handleAnchoredCardSelect}
        engagedAnchorNodeId={anchoredCardEngagement.nodeId}
        engagementKey={anchoredCardEngagement.key}
        foldBudget={use2D}
      />

      {/* Cluster labels moved inside Canvas as children of ConstellationScene */}

      {/* SSR content for SEO â€” hidden from visual users */}
      <section className="sr-only" aria-label="Governance entity details">
        {children}
      </section>

      {/* Globe controls â€” z-20: floating top-left */}
      <div className="absolute top-20 left-4 z-20 pointer-events-auto">
        <GlobeControls
          listOpen={listOpen}
          onToggleList={handleToggleList}
          activeFilter={filter}
          onCycleFilter={handleCycleFilter}
          onResetGlobe={handleResetGlobe}
        />
      </div>

      {/* List overlay â€” z-25: left side panel */}
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

      {/* Workspace cards overlay â€” z-28 */}
      {workspaceCardsVisible && <WorkspaceCards onClose={() => setWorkspaceCardsVisible(false)} />}

      {/* Panel overlay â€” z-30: entity detail panels over the globe */}
      {showRoutePanel && (
        <PanelOverlay
          onClose={handlePanelClose}
          collapsed={seneca.isOpen}
          onExpand={() => seneca.close()}
        />
      )}

      {/* Cursor-following tooltip */}
      <GlobeTooltip
        node={shouldShowHoverTooltip ? hoveredNode : null}
        screenPos={hoverScreenPos}
        showMatchCta={!isAuthenticated}
        hoverDetailLevel={hoverDetailLevel}
      />

      {/* Entity detail sheet â€” bottom sheet for entity clicks on homepage */}
      <EntityDetailSheet entity={activeEntity} onClose={handleEntityClose} />

      {/* Discovery overlay â€” filter-driven entity list */}
      <DiscoveryOverlay
        filter={filter}
        initialSort={initialSort}
        onEntitySelect={handleEntitySelect}
        onClose={() => {
          setFilter(null);
          bridge.executeGlobeCommand({ type: 'clear' });
        }}
      />

      {/* Since last visit â€” compact activity summary for returning authenticated users */}
      {previousVisitAt && isAuthenticated && (
        <div className="fixed bottom-[calc(theme(spacing.6)+14rem)] left-6 z-40 w-[min(440px,calc(100vw-3rem))] max-md:bottom-[calc(14rem)] max-md:left-4 max-md:right-4 max-md:w-auto">
          <SinceLastVisit previousVisitAt={previousVisitAt} delegatedDrepId={drepId} />
        </div>
      )}

      {/* Seneca companion provided by GovernadaShell (app-wide) â€” no duplication here */}
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

function getTouchPreviewPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  return { x: window.innerWidth / 2, y: window.innerHeight * 0.36 };
}

function nodeToEntityParam(node: ConstellationNode3D): string {
  const nodeType = node.nodeType ?? 'drep';
  if (nodeType === 'proposal') {
    const id = node.fullId || node.id;
    const lastUnderscore = id.lastIndexOf('_');
    if (lastUnderscore > 0) {
      return encodeEntityParam(
        'proposal',
        id.slice(0, lastUnderscore),
        id.slice(lastUnderscore + 1),
      );
    }
    return encodeEntityParam('proposal', id, '0');
  }
  if (nodeType === 'cc') return encodeEntityParam('cc', node.fullId || node.id);
  if (nodeType === 'spo') return encodeEntityParam('pool', node.fullId || node.id);
  return encodeEntityParam('drep', node.fullId || node.id);
}

function cardToEntityParam(card: AnchoredCardDescriptor): string | null {
  const hrefProposal = card.href?.match(/\/proposal\/([^/]+)\/(\d+)/);
  if (hrefProposal) {
    return encodeEntityParam('proposal', hrefProposal[1], hrefProposal[2]);
  }

  const hrefDrep = card.href?.match(/\/drep\/([^/?#]+)/);
  if (hrefDrep) return encodeEntityParam('drep', decodeURIComponent(hrefDrep[1]));

  const hrefPool = card.href?.match(/\/pool\/([^/?#]+)/);
  if (hrefPool) return encodeEntityParam('pool', decodeURIComponent(hrefPool[1]));

  const hrefCc = card.href?.match(/\/committee\/([^/?#]+)/);
  if (hrefCc) return encodeEntityParam('cc', decodeURIComponent(hrefCc[1]));

  const anchor = card.anchorNodeId;
  if (anchor.startsWith('proposal_')) {
    const lastUnderscore = anchor.lastIndexOf('_');
    if (lastUnderscore > 'proposal_'.length) {
      return encodeEntityParam(
        'proposal',
        anchor.slice('proposal_'.length, lastUnderscore),
        anchor.slice(lastUnderscore + 1),
      );
    }
  }
  if (anchor.startsWith('drep_')) return encodeEntityParam('drep', anchor.slice('drep_'.length));
  if (anchor.startsWith('spo_')) return encodeEntityParam('pool', anchor.slice('spo_'.length));
  if (anchor.startsWith('pool_')) return encodeEntityParam('pool', anchor.slice('pool_'.length));
  if (anchor.startsWith('cc_')) return encodeEntityParam('cc', anchor.slice('cc_'.length));

  if (
    anchor.startsWith('proposal-') ||
    anchor.startsWith('user-') ||
    anchor.startsWith('action-') ||
    anchor === 'proposal-pending'
  ) {
    return null;
  }

  return encodeEntityParam('drep', anchor);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
}

function getStatusCode(error: unknown): number {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof error.statusCode === 'number'
  ) {
    return error.statusCode;
  }
  return 0;
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

function deriveHoverDetailLevel(globe: ConstellationRef | null): HoverDetailLevel {
  const proximity = getSharedIntent().cameraProximity;
  if (proximity === 'overview' || proximity === 'cluster' || proximity === 'tight') {
    return proximity;
  }
  if (proximity === 'locked') return 'tight';

  const snapshot = globe?.getCameraSnapshot();
  if (!snapshot) return 'overview';

  const distance = distance3D(snapshot.position, snapshot.target);
  if (distance <= 6) return 'tight';
  if (distance <= 11) return 'cluster';
  return 'overview';
}

function findClosestCameraCluster(
  cameraTarget: [number, number, number],
  clusters: ClusterLabel[],
): ClusterLabel | null {
  if (clusters.length === 0) return null;

  let closest = clusters[0];
  let closestDistance = distance3D(cameraTarget, closest.centroid3D);

  for (let index = 1; index < clusters.length; index += 1) {
    const distance = distance3D(cameraTarget, clusters[index].centroid3D);
    if (distance < closestDistance) {
      closest = clusters[index];
      closestDistance = distance;
    }
  }

  if (closestDistance > MAX_CLUSTER_TARGET_DISTANCE) return null;

  return closest;
}

function distance3D(a: [number, number, number], b: [number, number, number]) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
