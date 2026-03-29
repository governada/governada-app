'use client';

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGovernanceConstellation } from '@/hooks/queries';
import { CameraControls, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useQuery } from '@tanstack/react-query';
import * as THREE from 'three';
import { computeGlobeLayout } from '@/lib/constellation/globe-layout';
import { DelegationBond as DelegationBondComponent } from '@/components/globe/DelegationBond';
// CCCrownRing removed — CC members now render as sentinel nodes within the constellation
import type {
  ConstellationApiData,
  FindMeTarget,
  ConstellationNode3D,
  ConstellationEdge3D,
} from '@/lib/constellation/types';

export type { ConstellationRef } from '@/components/GovernanceConstellation';

const DREP_COLOR = '#2dd4bf';
const SPO_COLOR = '#a78bfa'; // purple — visually distinct from teal DReps
// CC_COLOR moved to CCCrownRing.tsx
const USER_COLOR = '#f0e6d0'; // warm white-gold — personal, clearly "you"
const PROPOSAL_COLOR = '#d4a050'; // warm amber — active governance events within the constellation
const MATCH_COLOR = '#f59e0b'; // Warm amber — distinct from teal, purple, gold

interface GlobeConstellationProps {
  interactive?: boolean;
  onReady?: () => void;
  onContracted?: () => void;
  onNodeSelect?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  /** Hover callback with screen coordinates for cursor-following tooltip */
  onNodeHoverScreen?: (
    node: ConstellationNode3D | null,
    screenPos: { x: number; y: number } | null,
  ) => void;
  className?: string;
  /** 0-100 governance health index — drives atmosphere color (teal=healthy, amber=stressed) */
  healthScore?: number;
  /** 0-100 governance urgency — drives heartbeat pulse frequency */
  urgency?: number;
  /** Enable breathing animation (gentle scale pulse) */
  breathing?: boolean;
  /** Override the default camera position [x, y, z]. Default: [0, 3, 14] */
  initialCameraPosition?: [number, number, number];
  /** Override the default camera target [x, y, z]. Default: [0, 0, 0] */
  initialCameraTarget?: [number, number, number];
  /** Authenticated user's constellation node — rendered with distinctive glow */
  userNode?: ConstellationNode3D | null;
  /** Active proposal nodes to render as octahedra on the globe */
  proposalNodes?: ConstellationNode3D[];
  /** Delegation bond: delegated DRep node ID and drift score */
  delegationBond?: {
    drepNodeId: string;
    driftScore: number;
  } | null;
  /** When true, camera automatically flies to user node after layout computes */
  flyToUserOnReady?: boolean;
  /** Cockpit overlay color mode — changes how nodes are colored */
  overlayColorMode?: 'default' | 'urgent' | 'network' | 'proposals' | 'ecosystem';
  /** Set of node IDs that have urgent actions (for urgency pulsing) */
  urgentNodeIds?: Set<string>;
  /** Set of node IDs that just completed (flash green briefly) */
  completedNodeIds?: Set<string>;
  /** Set of node IDs that have been visited/inspected this session */
  visitedNodeIds?: Set<string>;
}

/**
 * FocusState — Universal focus/unfocus abstraction for the globe.
 *
 * Every visual mode (match flow, single node flyTo, vote split, temporal replay,
 * warm topic, overlay modes) writes to this single state. NodePoints reads ONLY
 * this to decide how to render each node — producing consistent "Cerebro" visuals
 * regardless of the trigger.
 */
export interface FocusState {
  /** Whether any focus mode is active — when true, unfocused nodes dim */
  active: boolean;
  /** Set of node IDs that are "in focus" — these glow, everything else dims */
  focusedIds: Set<string>;
  /** Per-node intensity (0-1) for focused nodes — drives glow strength, size boost */
  intensities: Map<string, number>;
  /** 0-1 scan progress — drives progressive unfocused fade (match flow advances this) */
  scanProgress: number;
  /** Optional color override per node (vote split colors, overlay modes) */
  colorOverrides: Map<string, string> | null;
  /** When set, only this node type can be focused — others are always unfocused */
  nodeTypeFilter: string | null;
}

const DEFAULT_FOCUS: FocusState = {
  active: false,
  focusedIds: new Set(),
  intensities: new Map(),
  scanProgress: 0,
  colorOverrides: null,
  nodeTypeFilter: null,
};

// Window-level shared focus state — bridges React outer tree ↔ R3F Canvas tree.
// R3F's reconciler doesn't re-render components inside <Canvas> when parent state
// changes. Module-level variables can be duplicated by bundler chunk splitting.
// Window globals are truly shared — no boundary issues possible.
const FOCUS_KEY = '__globeFocusState' as const;
const FOCUS_VER_KEY = '__globeFocusVersion' as const;

function getSharedFocus(): FocusState {
  if (typeof window === 'undefined') return DEFAULT_FOCUS;
  return ((window as unknown as Record<string, unknown>)[FOCUS_KEY] as FocusState) ?? DEFAULT_FOCUS;
}

function setSharedFocus(focus: FocusState): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  w[FOCUS_KEY] = focus;
  w[FOCUS_VER_KEY] = ((w[FOCUS_VER_KEY] as number) ?? 0) + 1;
}

function getSharedFocusVersion(): number {
  if (typeof window === 'undefined') return 0;
  return ((window as unknown as Record<string, unknown>)[FOCUS_VER_KEY] as number) ?? 0;
}

interface SceneState {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
  pulseId: string | null;
  animating: boolean;
  flyToTarget: [number, number, number] | null;
  flyToActive: boolean;
  /** Universal focus state — the single source of truth for node visual treatment */
  focus: FocusState;
  /** Raw vote data — feeds into focus.colorOverrides but needed by temporal scrubber UI */
  voteSplitMap: Map<string, 'Yes' | 'No' | 'Abstain'> | null;
  /** Temporal replay: 0-1 progress through an epoch's governance events */
  temporalProgress: number;
  /** Temporal replay: cumulative vote map built as progress advances */
  temporalVoteMap: Map<string, 'Yes' | 'No' | 'Abstain'>;
  /** Whether temporal replay mode is active */
  temporalActive: boolean;
}

// Earth-like axial tilt: 23.4 degrees
const AXIAL_TILT = 23.4 * (Math.PI / 180);
const INITIAL_CAMERA: [number, number, number] = [0, 3, 14];
const INITIAL_TARGET: [number, number, number] = [0, 0, 0];
const DEFAULT_ROTATION_SPEED = 0.005; // slow, contemplative rotation (~21 min/revolution)

export const GlobeConstellation = forwardRef<
  import('@/components/GovernanceConstellation').ConstellationRef,
  GlobeConstellationProps
>(function GlobeConstellation(
  {
    interactive,
    onReady,
    onContracted,
    onNodeSelect,
    onNodeHover,
    onNodeHoverScreen,
    className,
    healthScore = 75,
    urgency = 30,
    breathing = false,
    initialCameraPosition,
    initialCameraTarget,
    userNode,
    proposalNodes,
    delegationBond,
    flyToUserOnReady = false,
    overlayColorMode = 'default',
    urgentNodeIds,
    completedNodeIds,
    visitedNodeIds,
  },
  ref,
) {
  const cameraControlsRef = useRef<CameraControls>(null);
  const rotationAngleRef = useRef(0);
  const rotationSpeedRef = useRef(DEFAULT_ROTATION_SPEED);
  const userFlyInDone = useRef(false);
  const [ready, setReady] = useState(false);

  // Cinematic animation state — drives per-frame smooth transitions
  const cinematicRef = useRef({
    orbitSpeed: 0, // radians/sec (0 = use default rotation)
    dollyTarget: 14, // camera distance target
    dimTarget: 0, // target dim for non-matched nodes (0-1)
    transitionDuration: 0.8,
    active: false, // whether cinematic mode is engaged
  });
  const [cinematicOrbitSpeed, setCinematicOrbitSpeed] = useState(0);
  const [cinematicDollyTarget, setCinematicDollyTarget] = useState(14);

  // Effective camera position/target — allow overrides from props
  const effectiveCamera = useMemo(
    () => initialCameraPosition ?? INITIAL_CAMERA,
    [initialCameraPosition],
  );
  const effectiveTarget = useMemo(
    () => initialCameraTarget ?? INITIAL_TARGET,
    [initialCameraTarget],
  );

  // Mouse position tracking for tooltip placement
  const mouseScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sceneState, setSceneState] = useState<SceneState>({
    nodes: [],
    edges: [],
    nodeMap: new Map(),
    pulseId: null,
    animating: false,
    flyToTarget: null,
    flyToActive: false,
    focus: { ...DEFAULT_FOCUS },
    voteSplitMap: null,
    temporalProgress: 0,
    temporalVoteMap: new Map(),
    temporalActive: false,
  });
  const [quality, setQuality] = useState<'low' | 'mid' | 'high'>('high');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Bridge focus state into R3F's separate fiber tree.
  // R3F's <Canvas> creates an independent React root — children don't re-render
  // when parent state changes via useState. We store focus in a ref that R3F
  // components read in useFrame, and increment a version counter so useFrame
  // can detect changes without depending on React re-renders.
  // Sync focus to module-level shared state (readable by R3F useFrame)
  if (getSharedFocus() !== sceneState.focus) {
    setSharedFocus(sceneState.focus);
  }

  const { data: apiData } = useGovernanceConstellation();

  const onNodeSelectRef = useRef(onNodeSelect);
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  const onNodeHoverRef = useRef(onNodeHover);
  useEffect(() => {
    onNodeHoverRef.current = onNodeHover;
  }, [onNodeHover]);

  const onNodeHoverScreenRef = useRef(onNodeHoverScreen);
  useEffect(() => {
    onNodeHoverScreenRef.current = onNodeHoverScreen;
  }, [onNodeHoverScreen]);

  // Health-driven atmosphere color: teal (healthy) → amber (stressed) → red (critical)
  const healthProgress = useMemo(() => {
    // Invert: high health = 0 (cool teal), low health = 1 (warm amber/red)
    return Math.max(0, Math.min(1, 1 - healthScore / 100));
  }, [healthScore]);

  // Activity map: track which nodes have recent events for brightness boost
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    const typedData = apiData as ConstellationApiData | undefined;
    if (!typedData?.recentEvents) return map;
    const now = Date.now();
    for (const event of typedData.recentEvents) {
      const id = event.drepId;
      if (!id) continue;
      // More recent = brighter (1.0 = just happened, 0.2 = 7 days ago)
      const age = event.timestamp ? now - event.timestamp : 0;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const freshness = Math.max(0.2, 1 - age / maxAge);
      const existing = map.get(id) ?? 0;
      map.set(id, Math.max(existing, freshness));
    }
    return map;
  }, [apiData]);

  const flyToNodeImpl = async (nodeId: string): Promise<ConstellationNode3D | null> => {
    const controls = cameraControlsRef.current;
    if (!controls || sceneState.nodes.length === 0) return null;

    const node = sceneState.nodes.find((n) => n.id === nodeId || n.fullId === nodeId);
    if (!node) return null;

    setSceneState((prev) => ({
      ...prev,
      animating: true,
      focus: {
        ...DEFAULT_FOCUS,
        active: true,
        focusedIds: new Set([node.id]),
        intensities: new Map([[node.id, 1.0]]),
      },
    }));

    const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
    await controls.setLookAt(x * 1.5, y * 1.5, z * 1.5 + 3, x, y, z, true);

    // Resume rotation eligibility after fly-to completes
    setSceneState((prev) => ({ ...prev, animating: false }));

    onNodeSelectRef.current?.(node);
    return node;
  };

  useImperativeHandle(ref, () => ({
    findMe: async (target: FindMeTarget) => {
      const controls = cameraControlsRef.current;
      if (!controls || sceneState.nodes.length === 0) return;
      setSceneState((prev) => ({ ...prev, animating: true }));

      if (target.type === 'undelegated') {
        // Place user node on the globe surface at a visible spot
        const edgePos: [number, number, number] = [7, -4, 2];
        setSceneState((prev) => ({
          ...prev,
          focus: {
            ...DEFAULT_FOCUS,
            active: true,
            focusedIds: new Set(['__user__']),
            intensities: new Map([['__user__', 1.0]]),
          },
          nodes: [
            ...prev.nodes,
            {
              id: '__user__',
              fullId: '__user__',
              name: 'You',
              power: 0,
              score: 50,
              dominant: 'transparency',
              alignments: [50, 50, 50, 50, 50, 50],
              position: edgePos,
              scale: 0.08,
              nodeType: 'drep',
            },
          ],
        }));
        const rotated = rotateAroundY(edgePos, rotationAngleRef.current);
        await controls.setLookAt(rotated[0], rotated[1], 16, rotated[0], rotated[1], 0, true);
        await sleep(2000);
        setSceneState((prev) => ({ ...prev, animating: false }));
        onContracted?.();
        return;
      }

      const drepId = target.drepId;
      if (!drepId) {
        setSceneState((prev) => ({ ...prev, animating: false }));
        onContracted?.();
        return;
      }

      const node = sceneState.nodeMap.get(drepId);
      if (!node) {
        setSceneState((prev) => ({ ...prev, animating: false }));
        onContracted?.();
        return;
      }

      setSceneState((prev) => ({
        ...prev,
        focus: {
          ...DEFAULT_FOCUS,
          active: true,
          focusedIds: new Set([drepId]),
          intensities: new Map([[drepId, 1.0]]),
        },
      }));

      const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
      await controls.setLookAt(x * 1.5, y * 1.5, z * 1.5 + 3, x, y, z, true);
      await sleep(2000);

      setSceneState((prev) => ({ ...prev, focus: { ...DEFAULT_FOCUS } }));
      await controls.setLookAt(...effectiveCamera, ...effectiveTarget, true);
      await sleep(800);
      setSceneState((prev) => ({ ...prev, animating: false }));
      onContracted?.();
    },

    flyToNode: flyToNodeImpl,

    pulseNode: (drepId: string) => {
      setSceneState((prev) => ({ ...prev, pulseId: drepId }));
      setTimeout(() => setSceneState((prev) => ({ ...prev, pulseId: null })), 1200);
    },

    resetCamera: () => {
      cameraControlsRef.current?.setLookAt(...effectiveCamera, ...effectiveTarget, true);
      setSceneState((prev) => ({
        ...prev,
        focus: { ...DEFAULT_FOCUS },
        animating: false,
        voteSplitMap: null,
        temporalProgress: 0,
        temporalVoteMap: new Map(),
        temporalActive: false,
      }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
    },

    highlightMatches: (
      userAlignment: number[],
      threshold: number,
      options?: {
        noZoom?: boolean;
        zoomToCluster?: boolean;
        nodeTypeFilter?: string;
        cameraAngle?: number;
        cameraElevation?: number;
        drepOnly?: boolean;
        /** When set, ignore threshold and take the N closest nodes instead.
         *  This guarantees visible progressive narrowing regardless of data distribution. */
        topN?: number;
        /** 0-1 scan progress override (used when topN replaces threshold-based progress) */
        scanProgressOverride?: number;
      },
    ) => {
      const matched = new Set<string>();
      const intensities = new Map<string, number>();

      // Compute distances for all eligible nodes
      const scored: Array<{ id: string; distance: number }> = [];
      for (const node of sceneState.nodes) {
        if (options?.nodeTypeFilter && node.nodeType !== options.nodeTypeFilter) continue;
        if (options?.drepOnly && node.nodeType !== 'drep') continue;
        let sumSq = 0;
        for (let d = 0; d < 6; d++) {
          const diff = (userAlignment[d] ?? 50) - (node.alignments[d] ?? 50);
          sumSq += diff * diff;
        }
        scored.push({ id: node.id, distance: Math.sqrt(sumSq) });
      }

      if (options?.topN && options.topN > 0) {
        // Top-N mode: rank by distance, take the closest N
        scored.sort((a, b) => a.distance - b.distance);
        const maxDist = scored[Math.min(options.topN, scored.length) - 1]?.distance ?? 1;
        for (let i = 0; i < Math.min(options.topN, scored.length); i++) {
          matched.add(scored[i].id);
          intensities.set(scored[i].id, Math.max(0.2, 1 - scored[i].distance / (maxDist * 1.2)));
        }
      } else {
        // Threshold mode: include all within distance
        for (const s of scored) {
          if (s.distance < threshold) {
            matched.add(s.id);
            intensities.set(s.id, Math.max(0, Math.min(1, 1 - s.distance / threshold)));
          }
        }
      }

      // Compute scanning progress
      const scanProgress =
        options?.scanProgressOverride ?? Math.max(0, Math.min(1, (160 - threshold) / 125));

      setSceneState((prev) => ({
        ...prev,
        focus: {
          // Stay active if already in a focus mode (e.g., matchStart set it) or if we have matches
          active: matched.size > 0 || prev.focus.active,
          focusedIds: matched,
          intensities,
          scanProgress,
          colorOverrides: null,
          nodeTypeFilter: options?.drepOnly
            ? 'drep'
            : (options?.nodeTypeFilter ?? prev.focus.nodeTypeFilter),
        },
      }));

      // Q1-Q2: highlight only, no camera movement.
      if (options?.noZoom) {
        return;
      }

      // Data-driven camera: fly to the centroid of matched nodes
      // No artificial angles — the centroid naturally shifts as the alignment vector changes
      // Each answer moves the centroid to a different sector of the globe (60° per dimension)
      if (options?.zoomToCluster && matched.size > 0 && cameraControlsRef.current) {
        let cx = 0,
          cy = 0,
          cz = 0,
          count = 0;
        for (const node of sceneState.nodes) {
          if (matched.has(node.id)) {
            const [rx, ry, rz] = rotateAroundY(node.position, rotationAngleRef.current);
            cx += rx;
            cy += ry;
            cz += rz;
            count++;
          }
        }
        if (count > 0) {
          cx /= count;
          cy /= count;
          cz /= count;
          const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
          const nx = cx / dir;
          const ny = cy / dir;
          const nz = cz / dir;

          // Stop rotation — globe locked during search
          rotationSpeedRef.current = 0;

          // Camera pulls closer as the cluster narrows — funneling toward the match
          const zoomFactor = Math.max(0, Math.min(1, (160 - threshold) / 125));
          const camDist = 14 - zoomFactor * 6; // 14 → 8 (wide overview → close to cluster)

          // Camera position: facing the centroid, offset by dive angle for variety
          let camX = nx * camDist;
          let camY = ny * camDist + 1.5; // slight elevation for depth
          let camZ = nz * camDist;

          // Apply dive angle (azimuth rotation around Y) — each question approaches differently
          if (options?.cameraAngle) {
            const cos = Math.cos(options.cameraAngle);
            const sin = Math.sin(options.cameraAngle);
            const rx = camX * cos - camZ * sin;
            const rz = camX * sin + camZ * cos;
            camX = rx;
            camZ = rz;
          }
          // Apply elevation offset — vertical variety per question
          if (options?.cameraElevation) {
            camY += camDist * Math.sin(options.cameraElevation);
          }

          // Look at the cluster centroid
          const controls = cameraControlsRef.current;
          controls.smoothTime = 1.0;
          controls.setLookAt(camX, camY, camZ, cx * 0.7, cy * 0.7, cz * 0.7, true);
          setTimeout(() => {
            if (cameraControlsRef.current) cameraControlsRef.current.smoothTime = 0.8;
          }, 1500);
        }
        return;
      }

      // Default fallback: progressive zoom (legacy behavior)
      if (matched.size > 0 && cameraControlsRef.current) {
        let cx = 0,
          cy = 0,
          cz = 0,
          count = 0;
        for (const node of sceneState.nodes) {
          if (matched.has(node.id)) {
            const [rx, ry, rz] = rotateAroundY(node.position, rotationAngleRef.current);
            cx += rx;
            cy += ry;
            cz += rz;
            count++;
          }
        }
        if (count > 0) {
          cx /= count;
          cy /= count;
          cz /= count;
          const zoomFactor = Math.max(0, Math.min(1, (160 - threshold) / 125));
          rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * (1 - zoomFactor * 0.85);
          const camDist = 14 - zoomFactor * 6;
          const lookWeight = 0.4 + zoomFactor * 0.5;
          const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
          const nx = cx / dir;
          const ny = cy / dir;
          const nz = cz / dir;
          cameraControlsRef.current.setLookAt(
            nx * camDist * lookWeight,
            ny * camDist * lookWeight + (3 - zoomFactor * 1.5),
            nz * camDist * (1 - lookWeight * 0.3) + camDist * 0.5,
            cx * lookWeight,
            cy * lookWeight,
            cz * lookWeight,
            true, // animated smooth transition
          );
        }
      }
    },

    flyToMatch: async (drepId: string) => {
      // Final "locking on" — fly to the top match node dramatically
      const node = sceneState.nodes.find((n) => n.id === drepId || n.fullId === drepId);
      if (!node || !cameraControlsRef.current) return;

      // Stop rotation completely
      rotationSpeedRef.current = 0;

      // Compute the rotated target position for particles
      const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);

      // Ensure node is on the visible side (prevent camera clipping through globe)
      const dist = Math.sqrt(x * x + y * y + z * z);
      const nx = dist > 0 ? x / dist : 0;
      const ny = dist > 0 ? y / dist : 0;
      const nz = dist > 0 ? z / dist : 1;

      // Pulse the node and activate fly-to particles
      setSceneState((prev) => ({
        ...prev,
        pulseId: drepId,
        animating: true,
        flyToTarget: [x, y, z],
        flyToActive: true,
      }));

      // Fly to the node — camera positioned directly along the node's outward direction
      // so the node appears dead-center on screen. No Y/Z offsets that shift it off-axis.
      const camDist = Math.max(dist * 1.8, 8);

      // Smooth cinematic fly-in — camera looks straight at the node
      await cameraControlsRef.current.setLookAt(
        nx * camDist,
        ny * camDist,
        nz * camDist,
        x,
        y,
        z,
        false,
      );

      // Hold the dramatic lock — the "Cerebro found you" moment
      // Keep the node highlighted and rotation stopped — results will render over this
      await sleep(3000);
      setSceneState((prev) => ({
        ...prev,
        pulseId: null,
        animating: false,
        flyToActive: false,
        // Keep flyToTarget set so the globe stays focused on the match
      }));
      // Don't restore rotation — let the globe stay locked during results
    },

    matchStart: () => {
      // "Entering Cerebro" — light up all DRep nodes, dim everything else
      const drepIds = new Set<string>();
      const intensities = new Map<string, number>();
      for (const node of sceneState.nodes) {
        if (node.nodeType === 'drep') {
          drepIds.add(node.id);
          intensities.set(node.id, 0.6); // warm glow, not max intensity
        }
      }

      setSceneState((prev) => ({
        ...prev,
        focus: {
          active: true,
          focusedIds: drepIds,
          intensities,
          scanProgress: 0,
          colorOverrides: null,
          nodeTypeFilter: 'drep',
        },
        flyToTarget: null,
        flyToActive: false,
      }));

      // Slow rotation to "scanning" pace
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * 0.6;

      // Shift camera slightly left to make room for Seneca panel on right
      if (cameraControlsRef.current) {
        cameraControlsRef.current.setLookAt(-2, 1.5, 16, -1, 0, 0, true);
      }
    },

    clearMatches: () => {
      setSceneState((prev) => ({
        ...prev,
        focus: { ...DEFAULT_FOCUS },
        flyToTarget: null,
        flyToActive: false,
        voteSplitMap: null,
        temporalProgress: 0,
        temporalVoteMap: new Map(),
        temporalActive: false,
      }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
      cameraControlsRef.current?.setLookAt(...effectiveCamera, ...effectiveTarget, true);
    },

    setVoteSplit: (map: Map<string, 'Yes' | 'No' | 'Abstain'> | null) => {
      if (!map) {
        setSceneState((prev) => ({
          ...prev,
          voteSplitMap: null,
          focus: { ...DEFAULT_FOCUS },
        }));
        return;
      }
      const focusedIds = new Set<string>();
      const intensities = new Map<string, number>();
      const colorOverrides = new Map<string, string>();
      const VOTE_COLORS = { Yes: '#2dd4bf', No: '#ef4444', Abstain: '#9ca3af' };
      for (const [nodeId, vote] of map) {
        focusedIds.add(nodeId);
        intensities.set(nodeId, 1.0);
        colorOverrides.set(nodeId, VOTE_COLORS[vote]);
      }
      setSceneState((prev) => ({
        ...prev,
        voteSplitMap: map,
        focus: {
          active: true,
          focusedIds,
          intensities,
          scanProgress: 0,
          colorOverrides,
          nodeTypeFilter: null,
        },
      }));
    },

    setTemporalState: (progress: number, voteMap: Map<string, 'Yes' | 'No' | 'Abstain'>) => {
      const focusedIds = new Set<string>();
      const intensities = new Map<string, number>();
      const colorOverrides = new Map<string, string>();
      const VOTE_COLORS = { Yes: '#2dd4bf', No: '#ef4444', Abstain: '#9ca3af' };
      for (const [nodeId, vote] of voteMap) {
        focusedIds.add(nodeId);
        intensities.set(nodeId, 1.0);
        colorOverrides.set(nodeId, VOTE_COLORS[vote]);
      }
      setSceneState((prev) => ({
        ...prev,
        temporalProgress: progress,
        temporalVoteMap: voteMap,
        temporalActive: true,
        focus: {
          active: true,
          focusedIds,
          intensities,
          scanProgress: 0,
          colorOverrides,
          nodeTypeFilter: null,
        },
      }));
    },

    clearTemporal: () => {
      setSceneState((prev) => ({
        ...prev,
        temporalProgress: 0,
        temporalVoteMap: new Map(),
        temporalActive: false,
        focus: { ...DEFAULT_FOCUS },
      }));
    },

    /** Dim all nodes — focus active with empty focusedIds = everything unfocused */
    dimAll: () => {
      setSceneState((prev) => ({
        ...prev,
        focus: {
          active: true,
          focusedIds: new Set(),
          intensities: new Map(),
          scanProgress: 0,
          colorOverrides: null,
          nodeTypeFilter: null,
        },
      }));
    },

    highlightNode: (nodeId: string | null) => {
      if (!nodeId) {
        setSceneState((prev) => ({ ...prev, focus: { ...DEFAULT_FOCUS } }));
        return;
      }
      setSceneState((prev) => ({
        ...prev,
        focus: {
          active: true,
          focusedIds: new Set([nodeId]),
          intensities: new Map([[nodeId, 1.0]]),
          scanProgress: 0,
          colorOverrides: null,
          nodeTypeFilter: null,
        },
      }));
    },

    setRotationSpeed: (multiplier: number) => {
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * multiplier;
    },

    zoomToDistance: (distance: number) => {
      cameraControlsRef.current?.dollyTo(distance, true);
    },

    flashNode: (nodeId: string) => {
      // Flash uses the pulse mechanism with a shorter duration for a "pop" effect
      setSceneState((prev) => ({ ...prev, pulseId: nodeId }));
      setTimeout(() => setSceneState((prev) => ({ ...prev, pulseId: null })), 400);
    },

    setCinematicState: (state) => {
      const c = cinematicRef.current;
      if (state.orbitSpeed !== undefined) {
        c.orbitSpeed = state.orbitSpeed;
        setCinematicOrbitSpeed(state.orbitSpeed);
      }
      if (state.dollyTarget !== undefined) {
        c.dollyTarget = state.dollyTarget;
        setCinematicDollyTarget(state.dollyTarget);
      }
      if (state.dimTarget !== undefined) c.dimTarget = state.dimTarget;
      if (state.transitionDuration !== undefined) c.transitionDuration = state.transitionDuration;
      c.active = true;
    },
  }));

  useEffect(() => {
    if (!apiData) return;
    const gpu = estimateGPUTier();
    setQuality(gpu);
    const nodeLimit = gpu === 'low' ? 200 : gpu === 'mid' ? 500 : 800;
    const typedData = apiData as ConstellationApiData;
    const layout = computeGlobeLayout(typedData.nodes, nodeLimit);

    // Inject authenticated user's node into the constellation
    if (userNode) {
      layout.nodes.push(userNode);
      layout.nodeMap.set(userNode.id, userNode);
    }

    // Inject proposal nodes
    if (proposalNodes?.length) {
      for (const pNode of proposalNodes) {
        layout.nodes.push(pNode);
        layout.nodeMap.set(pNode.id, pNode);
      }
    }

    setSceneState((prev) => ({
      ...prev,
      nodes: layout.nodes,
      edges: layout.edges,
      nodeMap: layout.nodeMap,
    }));
    setReady(true);
    onReady?.();

    // Auto fly-in: camera swoops to the CENTER of the globe.
    // User is at the origin — governance nodes surround them on the sphere surface.
    // Look outward in any direction to see DReps, proposals, CC members. Planetarium.
    if (flyToUserOnReady && userNode && !userFlyInDone.current) {
      userFlyInDone.current = true;
      setTimeout(() => {
        const controls = cameraControlsRef.current;
        if (!controls) return;
        // Camera at center, looking outward (toward +X axis as default direction)
        controls.setLookAt(0, 0, 0, 8, 0, 0, true);
      }, 1200);
    }
  }, [apiData, onReady, userNode, proposalNodes, flyToUserOnReady]);

  const dpr =
    quality === 'low' ? 1 : quality === 'mid' ? 1.5 : Math.min(window.devicePixelRatio, 2);

  // --- Canvas-level interaction handlers ---
  // Track mouse position for hover tooltip positioning
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    mouseScreenRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  return (
    <div
      className={`relative z-0 w-full ${className || ''}`}
      style={{ background: '#0a0b14' }}
      onPointerMove={handlePointerMove}
    >
      {ready && (
        <Canvas
          dpr={dpr}
          camera={{ position: effectiveCamera, fov: 60 }}
          gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          role="img"
          aria-label="Governance constellation visualization"
        >
          <color
            attach="background"
            args={[
              overlayColorMode === 'urgent'
                ? '#120a0a'
                : overlayColorMode === 'network'
                  ? '#0a1214'
                  : overlayColorMode === 'proposals'
                    ? '#12100a'
                    : '#0a0b14',
            ]}
          />
          <ambientLight intensity={0.05} />

          <AmbientStarfield count={quality === 'low' ? 200 : 400} />
          <TiltedGlobeGroup
            rotationRef={rotationAngleRef}
            speedRef={rotationSpeedRef}
            breathing={breathing && !sceneState.focus.active}
            urgency={urgency}
          >
            {/* Subtle point light at center (no visible sphere) */}
            <pointLight color="#4466aa" intensity={0.8} distance={10} decay={2} />
            <GlobeAtmosphere
              radius={8.1}
              color={
                overlayColorMode === 'urgent'
                  ? '#cc4444'
                  : overlayColorMode === 'network'
                    ? '#44bbcc'
                    : overlayColorMode === 'proposals'
                      ? '#ccaa44'
                      : '#4488cc'
              }
              warmColor="#cc8844"
              intensity={
                overlayColorMode === 'urgent'
                  ? 0.6
                  : overlayColorMode === 'network' || overlayColorMode === 'proposals'
                    ? 0.5
                    : 0.4
              }
              matchProgress={
                sceneState.focus.scanProgress > 0
                  ? sceneState.focus.scanProgress
                  : healthProgress * 0.3
              }
            />
            {/* Wireframe removed — the latitude lines (especially equator) were visually distracting */}
            <ConstellationNodes
              nodes={sceneState.nodes}
              focus={sceneState.focus}
              pulseId={sceneState.pulseId}
              interactive={interactive}
              overlayColorMode={overlayColorMode}
              urgentNodeIds={urgentNodeIds}
              completedNodeIds={completedNodeIds}
              onNodeHover={(node) => {
                onNodeHoverRef.current?.(node);
                onNodeHoverScreenRef.current?.(node, node ? { ...mouseScreenRef.current } : null);
              }}
              activityMap={activityMap}
            />
            <ConstellationEdges edges={sceneState.edges} focusActive={sceneState.focus.active} />
            {quality !== 'low' && (
              <NeuralMesh nodes={sceneState.nodes} focusActive={sceneState.focus.active} />
            )}
            <NetworkEdgeLines nodes={sceneState.nodes} visible={overlayColorMode === 'network'} />
            {delegationBond &&
              userNode &&
              (() => {
                const drepNode = sceneState.nodeMap.get(delegationBond.drepNodeId);
                if (!drepNode) return null;
                return (
                  <DelegationBondComponent
                    userPosition={userNode.position}
                    drepPosition={drepNode.position}
                    driftScore={delegationBond.driftScore}
                    visible
                  />
                );
              })()}
            {quality !== 'low' && (
              <MatchedEdgeGlow nodes={sceneState.nodes} focus={sceneState.focus} />
            )}
            {quality !== 'low' && (
              <NetworkPulses edges={sceneState.edges} focusActive={sceneState.focus.active} />
            )}

            {/* CC members rendered as sentinel nodes within the constellation (no crown ring) */}
          </TiltedGlobeGroup>

          {quality !== 'low' && (
            <FlyToParticles target={sceneState.flyToTarget} active={sceneState.flyToActive} />
          )}
          <GloryRing target={sceneState.flyToTarget} active={sceneState.flyToActive} />

          {/* HeartbeatPulse removed — the expanding ring was visually distracting */}

          {quality !== 'low' && (
            <EffectComposer>
              <Bloom
                mipmapBlur
                intensity={
                  overlayColorMode === 'urgent'
                    ? 2.2
                    : overlayColorMode === 'proposals'
                      ? 2.0
                      : overlayColorMode === 'network'
                        ? 1.8
                        : 1.6
                }
                luminanceThreshold={0.15}
                luminanceSmoothing={0.9}
                radius={0.95}
              />
            </EffectComposer>
          )}

          {/* Non-interactive: Seneca controls camera via imperative setLookAt. No user orbit/zoom. */}
          <CameraControls
            ref={cameraControlsRef}
            makeDefault
            smoothTime={0.8}
            mouseButtons={{
              left: 0 as const,
              middle: 0 as const,
              right: 0 as const,
              wheel: 0 as const,
            }}
            touches={{ one: 0 as const, two: 0 as const, three: 0 as const }}
            minDistance={8}
            maxDistance={22}
          />
          <IdleCameraWobble controlsRef={cameraControlsRef} />
          <CinematicCamera
            controlsRef={cameraControlsRef}
            orbitSpeed={cinematicOrbitSpeed}
            dollyTarget={cinematicDollyTarget}
          />
        </Canvas>
      )}
    </div>
  );
});

// --- Atmospheric glow shell (fresnel rim effect) ---

const ATMOSPHERE_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMOSPHERE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  // Fresnel: bright at edges, transparent in center
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = 1.0 - abs(dot(viewDir, vNormal));
  float rim = pow(fresnel, 3.0) * uIntensity;
  gl_FragColor = vec4(uColor, rim);
}
`;

function GlobeAtmosphere({
  radius,
  color,
  warmColor,
  intensity,
  matchProgress = 0,
}: {
  radius: number;
  color: string;
  warmColor?: string;
  intensity: number;
  matchProgress?: number;
}) {
  const lerpedColor = useMemo(() => {
    if (!warmColor || matchProgress <= 0) return new THREE.Color(color);
    return new THREE.Color(color).lerp(new THREE.Color(warmColor), matchProgress);
  }, [color, warmColor, matchProgress]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: lerpedColor },
      uIntensity: { value: intensity },
    }),
    [lerpedColor, intensity],
  );

  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial
        vertexShader={ATMOSPHERE_VERT}
        fragmentShader={ATMOSPHERE_FRAG}
        uniforms={uniforms}
        transparent
        side={THREE.FrontSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

// GlobeWireframe removed — the latitude lines (especially the equator ring) were visually
// distracting and didn't clearly convey meaning. The atmosphere shells and node positions
// provide sufficient spatial reference.

// --- Point sprite shaders (same as original constellation) ---

const POINT_SCALE = 3.0;

const NODE_VERT = /* glsl */ `
attribute float aSize;
attribute float aDimmed;
attribute vec3 aNodeColor;
varying vec3 vColor;
varying float vAlpha;
varying float vDimmed;

void main() {
  vColor = aNodeColor;
  vDimmed = aDimmed;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 600.0 / -mvPosition.z;
  gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);
  vAlpha = aDimmed < 0.5 ? 1.0 : 0.06;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const NODE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDimmed;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  vec3 col = vColor * (1.0 + core * 1.5);
  // Desaturate dimmed nodes to near-invisible dark gray
  if (vDimmed > 0.5) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = vec3(lum * 0.15);
  }
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// Diamond-shaped fragment shader for SPO infrastructure nodes
const SPO_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vDimmed;

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  // Diamond (rotated square) distance: |x| + |y|
  float diamond = abs(p.x) + abs(p.y);
  if (diamond > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, diamond);
  float core = 1.0 - smoothstep(0.0, 0.15, diamond);
  vec3 col = vColor * (1.0 + core * 2.0);
  // Desaturate dimmed nodes to near-invisible dark gray
  if (vDimmed > 0.5) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = vec3(lum * 0.15);
  }
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// CC sentinel shader removed — CC symbology TBD, using standard node shader for now

// CC_FRAG removed — CC nodes now rendered via CCCrownRing (golden crown) instead of point sprites

// --- Network edge lines (rendered inside TiltedGlobeGroup) ---

const NETWORK_EDGE_COLORS: Record<string, string> = {
  delegation: '#2dd4bf',
  alignment: '#fbbf24',
  'cc-drep': '#a78bfa',
};

function NetworkEdgeLines({ nodes, visible }: { nodes: ConstellationNode3D[]; visible: boolean }) {
  // Fetch edge data from API
  const { data } = useQuery<{
    edges: Array<{ from: string; to: string; type: string; weight: number }>;
  }>({
    queryKey: ['cockpit-network-edges-scene'],
    queryFn: async () => {
      const res = await fetch('/api/cockpit/network-edges');
      if (!res.ok) return { edges: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: visible,
  });

  const lines = useMemo(() => {
    if (!visible || !data?.edges?.length || nodes.length === 0) return [];

    // Build nodeMap for position lookup
    const nodeMap = new Map<string, ConstellationNode3D>();
    for (const n of nodes) {
      nodeMap.set(n.id, n);
      if (n.fullId) nodeMap.set(n.fullId, n);
    }

    const result: Array<{
      points: [number, number, number][];
      color: string;
      type: string;
    }> = [];

    // Cap at 20 edges for performance
    for (const edge of data.edges.slice(0, 20)) {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      if (!fromNode || !toNode) continue;

      // Slightly offset lines above the globe surface to prevent z-fighting
      const lift = 0.15;
      const from = fromNode.position;
      const to = toNode.position;
      const fromLen = Math.sqrt(from[0] ** 2 + from[1] ** 2 + from[2] ** 2) || 1;
      const toLen = Math.sqrt(to[0] ** 2 + to[1] ** 2 + to[2] ** 2) || 1;

      result.push({
        points: [
          [
            from[0] * (1 + lift / fromLen),
            from[1] * (1 + lift / fromLen),
            from[2] * (1 + lift / fromLen),
          ],
          [to[0] * (1 + lift / toLen), to[1] * (1 + lift / toLen), to[2] * (1 + lift / toLen)],
        ],
        color: NETWORK_EDGE_COLORS[edge.type] ?? '#ffffff',
        type: edge.type,
      });
    }

    return result;
  }, [visible, data, nodes]);

  if (!visible || lines.length === 0) return null;

  return (
    <group>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          color={line.color}
          lineWidth={line.type === 'delegation' ? 1.5 : 1}
          transparent
          opacity={0.6}
          dashed={line.type !== 'delegation'}
          dashSize={line.type === 'alignment' ? 0.3 : 0.15}
          gapSize={line.type === 'alignment' ? 0.15 : 0.2}
        />
      ))}
    </group>
  );
}

// --- Scene sub-components ---

function RaycastConfig() {
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Three.js raycaster params must be mutated directly
    raycaster.params.Points = { threshold: 1.8 };
  }, [raycaster]);
  return null;
}

function ConstellationNodes({
  nodes,
  focus,
  pulseId,
  interactive,
  onNodeClick,
  onNodeHover,
  activityMap,
  overlayColorMode = 'default',
  urgentNodeIds,
  completedNodeIds,
  hoveredNodeId,
  visitedNodeIds,
}: {
  nodes: ConstellationNode3D[];
  focus: FocusState;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  activityMap?: Map<string, number>;
  overlayColorMode?: 'default' | 'urgent' | 'network' | 'proposals' | 'ecosystem';
  urgentNodeIds?: Set<string>;
  completedNodeIds?: Set<string>;
  hoveredNodeId?: string | null;
  visitedNodeIds?: Set<string>;
}) {
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFrameReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const groups = useMemo(() => {
    const drep: ConstellationNode3D[] = [];
    const spo: ConstellationNode3D[] = [];
    const cc: ConstellationNode3D[] = [];
    const user: ConstellationNode3D[] = [];
    const proposal: ConstellationNode3D[] = [];
    for (const n of nodes) {
      if (n.nodeType === 'user') {
        user.push(n);
        continue;
      }
      if (n.nodeType === 'proposal') {
        proposal.push(n);
        continue;
      }
      if (n.nodeType === 'spo') spo.push(n);
      else if (n.nodeType === 'cc') cc.push(n);
      else drep.push(n);
    }
    return { drep, spo, cc, user, proposal };
  }, [nodes]);

  // Overlay-aware color callbacks: dim non-relevant node types per overlay mode
  const DIMMED_COLOR = '#151515'; // near-black for non-relevant nodes — dramatic visual separation
  const URGENT_DREP_BRIGHT = '#ff4444'; // bright red for urgent emphasis
  const COMPLETED_GREEN = '#22c55e'; // green flash for completed actions
  const NETWORK_TEAL = '#5eead4'; // brighter teal for network overlay delegation nodes
  const PROPOSAL_BRIGHT = '#f5eedf'; // warm bright for proposal overlay emphasis
  const getDrepColor = useCallback(
    (node: ConstellationNode3D) => {
      // Completed nodes flash green (takes priority over all overlays)
      if (completedNodeIds?.has(node.id)) return COMPLETED_GREEN;
      // Vote split / temporal colors now handled via focus.colorOverrides in NodePoints
      // Urgent overlay: non-urgent dim hard, urgent glow bright red
      if (overlayColorMode === 'urgent') {
        if (urgentNodeIds?.has(node.id)) return URGENT_DREP_BRIGHT;
        return DIMMED_COLOR;
      }
      // Proposals overlay: DReps are not proposals, dim them
      if (overlayColorMode === 'proposals') return DIMMED_COLOR;
      // Network overlay: brighten DReps (they're delegation targets)
      if (overlayColorMode === 'network') return NETWORK_TEAL;
      return DREP_COLOR;
    },
    [overlayColorMode, urgentNodeIds, completedNodeIds],
  );
  const getSpoColor = useCallback(
    () => (overlayColorMode === 'proposals' ? DIMMED_COLOR : SPO_COLOR),
    [overlayColorMode],
  );
  const CC_SENTINEL_COLOR = '#d4a050'; // Wayfinder Amber — sentinel warmth
  const getCcColor = useCallback(() => CC_SENTINEL_COLOR, []);
  const getUserColor = useCallback(() => USER_COLOR, []);
  const getProposalColor = useCallback(
    (node?: ConstellationNode3D) => {
      if (node && completedNodeIds?.has(node.id)) return COMPLETED_GREEN;
      // Proposals overlay: proposals glow bright
      if (overlayColorMode === 'proposals') return PROPOSAL_BRIGHT;
      // Network overlay: proposals are not delegation entities, dim them
      if (overlayColorMode === 'network') return DIMMED_COLOR;
      // Urgent overlay: proposals with urgent status keep color, others dim
      if (overlayColorMode === 'urgent') {
        if (node && urgentNodeIds?.has(node.id)) return PROPOSAL_BRIGHT;
        return DIMMED_COLOR;
      }
      return PROPOSAL_COLOR;
    },
    [overlayColorMode, completedNodeIds, urgentNodeIds],
  );

  if (nodes.length === 0 || !frameReady) return null;

  return (
    <>
      {interactive && <RaycastConfig />}
      <NodePoints
        nodes={groups.drep}
        focus={focus}
        hoveredNodeId={hoveredNodeId}
        visitedNodeIds={visitedNodeIds}
        pulseId={pulseId}
        interactive={interactive}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        getColor={getDrepColor}
        emissive={2.0}
        activityMap={activityMap}
      />
      {groups.spo.length > 0 && (
        <NodePoints
          nodes={groups.spo}
          focus={focus}
          hoveredNodeId={hoveredNodeId}
          visitedNodeIds={visitedNodeIds}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getSpoColor}
          emissive={focus.nodeTypeFilter === 'drep' ? 0.1 : 2.0}
          fragmentShader={SPO_FRAG}
          activityMap={activityMap}
        />
      )}
      {/* CC members — rendered as standard nodes (symbology TBD) */}
      {groups.cc.length > 0 && (
        <NodePoints
          nodes={groups.cc}
          focus={focus}
          pulseId={pulseId}
          interactive={false}
          getColor={getCcColor}
          emissive={focus.nodeTypeFilter === 'drep' ? 0.1 : 2.0}
          activityMap={activityMap}
        />
      )}
      {groups.user.length > 0 && (
        <NodePoints
          nodes={groups.user}
          focus={{ ...DEFAULT_FOCUS }}
          hoveredNodeId={hoveredNodeId}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getUserColor}
          emissive={6.0}
          activityMap={activityMap}
        />
      )}
      {groups.proposal.length > 0 && (
        <NodePoints
          nodes={groups.proposal}
          focus={focus}
          hoveredNodeId={hoveredNodeId}
          visitedNodeIds={visitedNodeIds}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getProposalColor}
          emissive={focus.nodeTypeFilter === 'drep' ? 0.1 : 2.5}
          activityMap={activityMap}
        />
      )}
    </>
  );
}

function NodePoints({
  nodes,
  focus,
  hoveredNodeId,
  visitedNodeIds,
  pulseId,
  interactive,
  onNodeClick,
  onNodeHover,
  getColor,
  emissive,
  fragmentShader,
  activityMap,
}: {
  nodes: ConstellationNode3D[];
  focus: FocusState;
  hoveredNodeId?: string | null;
  visitedNodeIds?: Set<string>;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  getColor: (node: ConstellationNode3D) => string;
  emissive: number;
  fragmentShader?: string;
  activityMap?: Map<string, number>;
}) {
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const matchColor = useMemo(() => new THREE.Color(MATCH_COLOR), []);

  // Reusable buffer computation function — used by both useMemo (initial) and useFrame (focus updates)
  const computeBuffers = useCallback(
    (focusState: FocusState) => {
      const count = nodes.length;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const dimmedArr = new Float32Array(count);

      for (let i = 0; i < count; i++) {
        const node = nodes[i];
        positions[i * 3] = node.position[0];
        positions[i * 3 + 1] = node.position[1];
        positions[i * 3 + 2] = node.position[2];

        const isFocused = focusState.focusedIds.has(node.id);
        const intensity = focusState.intensities.get(node.id) ?? 0;
        const isPulsing = pulseId === node.id;
        const isUnfocused = focusState.active && !isFocused && !isPulsing;

        // COLOR
        if (isUnfocused) {
          const dimVal = 0.012 - focusState.scanProgress * 0.007;
          colors[i * 3] = Math.max(0.005, dimVal);
          colors[i * 3 + 1] = Math.max(0.005, dimVal);
          colors[i * 3 + 2] = Math.max(0.005, dimVal);
        } else if (focusState.colorOverrides?.has(node.id)) {
          tmpColor.set(focusState.colorOverrides.get(node.id)!);
          colors[i * 3] = tmpColor.r * emissive;
          colors[i * 3 + 1] = tmpColor.g * emissive;
          colors[i * 3 + 2] = tmpColor.b * emissive;
        } else if (isFocused && intensity > 0) {
          tmpColor.set(getColor(node));
          const blend = intensity * 0.85;
          const blendedR = tmpColor.r + (matchColor.r - tmpColor.r) * blend;
          const blendedG = tmpColor.g + (matchColor.g - tmpColor.g) * blend;
          const blendedB = tmpColor.b + (matchColor.b - tmpColor.b) * blend;
          const matchEmissive = emissive * (1 + intensity * 1.2);
          colors[i * 3] = blendedR * matchEmissive;
          colors[i * 3 + 1] = blendedG * matchEmissive;
          colors[i * 3 + 2] = blendedB * matchEmissive;
        } else {
          tmpColor.set(getColor(node));
          const activity = activityMap?.get(node.id) ?? activityMap?.get(node.fullId) ?? 0;
          const activityBoost = 1 + activity * 0.8;
          const hoverBoost = hoveredNodeId === node.id ? 1.5 : 1.0;
          const visitedDim = visitedNodeIds?.has(node.id) ? 0.65 : 1.0;
          colors[i * 3] = tmpColor.r * emissive * activityBoost * hoverBoost * visitedDim;
          colors[i * 3 + 1] = tmpColor.g * emissive * activityBoost * hoverBoost * visitedDim;
          colors[i * 3 + 2] = tmpColor.b * emissive * activityBoost * hoverBoost * visitedDim;
        }

        // SIZE
        const isHovered = hoveredNodeId === node.id;
        const baseSize = isPulsing ? node.scale * 1.8 : isHovered ? node.scale * 1.6 : node.scale;
        let finalSize: number;
        if (isFocused) {
          finalSize = baseSize * (1 + 0.5 * intensity + focusState.scanProgress * 0.3);
        } else if (isUnfocused) {
          finalSize = baseSize * (0.5 - focusState.scanProgress * 0.1);
        } else {
          finalSize = baseSize;
        }
        sizes[i] = finalSize * POINT_SCALE;

        // DIMMED attribute (for shader)
        dimmedArr[i] = isUnfocused ? 1.0 : 0.0;
      }

      return { positions, colors, sizes, dimmedArr };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tmpColor/matchColor are stable refs
    [nodes, hoveredNodeId, visitedNodeIds, pulseId, getColor, emissive, activityMap],
  );

  // Target buffers ref — updated by useFrame when focus changes via _sharedFocusVersion
  const targetBuffersRef = useRef<{
    positions: Float32Array;
    colors: Float32Array;
    sizes: Float32Array;
    dimmedArr: Float32Array;
  } | null>(null);
  const lastFocusVersionRef = useRef(-1);

  // Initial buffer computation uses the focus prop (works on first mount).
  // Subsequent focus changes are detected in useFrame via _sharedFocusVersion.
  const buffers = useMemo(() => computeBuffers(focus), [computeBuffers, focus]);

  const geoRef = useRef<THREE.BufferGeometry>(null);

  // Per-frame smooth interpolation buffers (current = what's rendered, lerps toward target)
  const currentColorsRef = useRef<Float32Array | null>(null);
  const currentSizesRef = useRef<Float32Array | null>(null);
  const currentDimmedRef = useRef<Float32Array | null>(null);
  const isFirstRender = useRef(true);

  // Initialize GPU buffer attributes. Created once on first render.
  // Positions are static (nodes don't move on the globe sphere).
  // Colors/sizes/dimmed are lerped in-place by useFrame — no GPU reallocation needed.
  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;

    if (isFirstRender.current) {
      // First render: create all 4 GPU buffer attributes once
      geo.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
      currentColorsRef.current = new Float32Array(buffers.colors);
      currentSizesRef.current = new Float32Array(buffers.sizes);
      currentDimmedRef.current = new Float32Array(buffers.dimmedArr);
      geo.setAttribute('aNodeColor', new THREE.Float32BufferAttribute(currentColorsRef.current, 3));
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(currentSizesRef.current, 1));
      geo.setAttribute('aDimmed', new THREE.Float32BufferAttribute(currentDimmedRef.current, 1));
      geo.computeBoundingSphere();
      isFirstRender.current = false;
    } else if (
      currentColorsRef.current &&
      currentColorsRef.current.length !== buffers.colors.length
    ) {
      // Node count changed (rare: data reload, user node injection) — recreate all attributes
      // Delete old attributes (Three.js handles GPU cleanup via deleteAttribute)
      for (const name of ['position', 'aNodeColor', 'aSize', 'aDimmed']) {
        geo.deleteAttribute(name);
      }
      geo.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
      currentColorsRef.current = new Float32Array(buffers.colors);
      currentSizesRef.current = new Float32Array(buffers.sizes);
      currentDimmedRef.current = new Float32Array(buffers.dimmedArr);
      geo.setAttribute('aNodeColor', new THREE.Float32BufferAttribute(currentColorsRef.current, 3));
      geo.setAttribute('aSize', new THREE.Float32BufferAttribute(currentSizesRef.current, 1));
      geo.setAttribute('aDimmed', new THREE.Float32BufferAttribute(currentDimmedRef.current, 1));
      geo.computeBoundingSphere();
    }
    // After first render, useFrame handles smooth transitions toward new target buffers

    return () => {
      // Clean up GPU attributes on unmount
      const g = geoRef.current;
      if (!g) return;
      for (const name of ['position', 'aNodeColor', 'aSize', 'aDimmed']) {
        if (g.hasAttribute(name)) g.deleteAttribute(name);
      }
    };
  }, [buffers]);

  // Smooth per-frame interpolation: current values → target values.
  // Focus state is read from module-level _sharedFocus/_sharedFocusVersion
  // because R3F Canvas children don't re-render when parent state changes.
  useFrame((_, delta) => {
    const geo = geoRef.current;
    if (!geo || !currentColorsRef.current || !currentSizesRef.current || !currentDimmedRef.current)
      return;

    // Detect focus state changes via window-level shared variable.
    // No React props or refs — window globals, always readable from useFrame.
    // Only updates target color/size/dimmed arrays — positions are static (nodes don't move).
    const currentVersion = getSharedFocusVersion();
    if (currentVersion !== lastFocusVersionRef.current) {
      lastFocusVersionRef.current = currentVersion;
      targetBuffersRef.current = computeBuffers(getSharedFocus());
    }

    // Use shared targets if available (focus changed), otherwise fall back to initial buffers
    const targets = targetBuffersRef.current ?? buffers;

    // Exponential smoothing factor (frame-rate independent, ~0.6s transition)
    const factor = 1 - Math.pow(0.003, delta);
    let changed = false;
    const count = nodes.length;

    const targetColors = targets.colors;
    const targetSizes = targets.sizes;
    const targetDimmed = targets.dimmedArr;
    const curColors = currentColorsRef.current;
    const curSizes = currentSizesRef.current;
    const curDimmed = currentDimmedRef.current;

    // Faster factor for dimming transitions (nodes fade out quickly)
    const fastFactor = 1 - Math.pow(0.0001, delta); // ~3x faster than normal lerp

    // Lerp colors (RGB per node) — use fast factor when dimming
    for (let i = 0; i < count; i++) {
      const isDimming = targetDimmed[i] > 0.5;
      const f = isDimming ? fastFactor : factor;
      for (let c = 0; c < 3; c++) {
        const idx = i * 3 + c;
        const diff = targetColors[idx] - curColors[idx];
        if (Math.abs(diff) > 0.002) {
          curColors[idx] += diff * f;
          changed = true;
        }
      }
    }

    // Lerp sizes — dimming nodes shrink faster
    for (let i = 0; i < count; i++) {
      const isDimming = targetDimmed[i] > 0.5;
      const f = isDimming ? fastFactor : factor;
      const diff = targetSizes[i] - curSizes[i];
      if (Math.abs(diff) > 0.001) {
        curSizes[i] += diff * f;
        changed = true;
      }
    }

    // Lerp dimmed — fast transition so nodes fade out visibly
    for (let i = 0; i < count; i++) {
      const diff = targetDimmed[i] - curDimmed[i];
      if (Math.abs(diff) > 0.005) {
        curDimmed[i] += diff * fastFactor;
        changed = true;
      }
    }

    // Only push to GPU when something actually changed
    if (changed) {
      const colorAttr = geo.getAttribute('aNodeColor') as THREE.BufferAttribute;
      const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
      const dimAttr = geo.getAttribute('aDimmed') as THREE.BufferAttribute;
      if (colorAttr) colorAttr.needsUpdate = true;
      if (sizeAttr) sizeAttr.needsUpdate = true;
      if (dimAttr) dimAttr.needsUpdate = true;
    }
  });

  if (nodes.length === 0) return null;

  return (
    <points
      frustumCulled={false}
      onClick={
        interactive
          ? (e: { stopPropagation: () => void; index?: number }) => {
              e.stopPropagation();
              const idx = e.index;
              if (idx !== undefined && idx < nodes.length) {
                onNodeClick?.(nodes[idx]);
              }
            }
          : undefined
      }
      onPointerMove={
        interactive
          ? (e: { stopPropagation: () => void; index?: number }) => {
              const idx = e.index;
              if (idx !== undefined && idx < nodes.length) {
                onNodeHover?.(nodes[idx]);
              }
            }
          : undefined
      }
      onPointerEnter={
        interactive
          ? () => {
              document.body.style.cursor = 'pointer';
            }
          : undefined
      }
      onPointerLeave={
        interactive
          ? () => {
              document.body.style.cursor = '';
              onNodeHover?.(null);
            }
          : undefined
      }
    >
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        vertexShader={NODE_VERT}
        fragmentShader={fragmentShader ?? NODE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const EDGE_STYLES = {
  proximity: { color: '#4488aa', opacity: 0.12, dimOpacity: 0.03 },
  infrastructure: { color: '#7c6cc4', opacity: 0.15, dimOpacity: 0.04 },
  lastmile: { color: '#1a3a4a', opacity: 0.06, dimOpacity: 0.015 },
  orbital: { color: '#fbbf24', opacity: 0.3, dimOpacity: 0.08 }, // kept for type compat
} as const;

function EdgeLayer({
  edges,
  focusActive,
  edgeType,
}: {
  edges: ConstellationEdge3D[];
  focusActive: boolean;
  edgeType: keyof typeof EDGE_STYLES;
}) {
  const geometry = useMemo(() => {
    if (edges.length === 0) return null;
    const positions: number[] = [];
    for (const { from, to } of edges) {
      positions.push(...from, ...to);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [edges]);

  if (!geometry) return null;
  const style = EDGE_STYLES[edgeType];

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color={style.color}
        transparent
        opacity={focusActive ? style.dimOpacity : style.opacity}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function ConstellationEdges({
  edges,
  focusActive,
}: {
  edges: ConstellationEdge3D[];
  focusActive: boolean;
}) {
  const layers = useMemo(() => {
    const proximity: ConstellationEdge3D[] = [];
    const infrastructure: ConstellationEdge3D[] = [];
    const lastmile: ConstellationEdge3D[] = [];
    const orbital: ConstellationEdge3D[] = [];
    for (const e of edges) {
      if (e.edgeType === 'infrastructure') infrastructure.push(e);
      else if (e.edgeType === 'lastmile') lastmile.push(e);
      else if (e.edgeType === 'orbital') orbital.push(e);
      else proximity.push(e);
    }
    return { proximity, infrastructure, lastmile, orbital };
  }, [edges]);

  if (edges.length === 0) return null;

  return (
    <>
      <EdgeLayer edges={layers.proximity} focusActive={focusActive} edgeType="proximity" />
      <EdgeLayer edges={layers.lastmile} focusActive={focusActive} edgeType="lastmile" />
    </>
  );
}

// --- Neural mesh: gossamer threads connecting nearby nodes ---

/**
 * NeuralMesh — Very faint lines connecting nodes within proximity,
 * creating a neural network / synapse visual throughout the constellation.
 * Opacity is very low (0.03-0.06) so it reads as texture, not structure.
 */
function NeuralMesh({
  nodes,
  focusActive,
}: {
  nodes: ConstellationNode3D[];
  focusActive: boolean;
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const maxConnections = 600;
    let count = 0;

    // Connect each node to its 1-2 nearest neighbors within range
    for (let i = 0; i < nodes.length && count < maxConnections; i++) {
      const a = nodes[i];
      if (a.nodeType === 'user') continue;

      let nearest: { dist: number; pos: [number, number, number] } | null = null;

      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        if (b.nodeType === 'user') continue;
        const dx = a.position[0] - b.position[0];
        const dy = a.position[1] - b.position[1];
        const dz = a.position[2] - b.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 2.5) {
          positions.push(...a.position, ...b.position);
          count++;
          if (count >= maxConnections) break;
        } else if (dist < 4 && (!nearest || dist < nearest.dist)) {
          nearest = { dist, pos: b.position };
        }
      }

      // Add the nearest neighbor connection if no close ones found
      if (nearest && count < maxConnections) {
        positions.push(...a.position, ...nearest.pos);
        count++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#8ecae6"
        transparent
        opacity={focusActive ? 0.01 : 0.04}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}

// --- Ambient starfield (same as original) ---

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

function AmbientStarfield({ count }: { count: number }) {
  const circleMap = useMemo(() => makeCircleTexture(), []);

  const points = useMemo(() => {
    const rand = seededRandom(42);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 20 + rand() * 30;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return positions;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        map={circleMap}
        color="#c0d0ff"
        transparent
        opacity={0.5}
        sizeAttenuation
        toneMapped={false}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// --- Subtle inner glow (planet core visible through translucent surface) ---

// InnerGlow removed — the center opaque sphere was visually distracting.
// Point light preserved inline in the scene tree.

// --- Network pulse particles (light flowing along edges) ---

const PULSE_COUNT = 70;

const PULSE_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aPulseColor;
varying float vAlpha;
varying vec3 vPulseColor;

void main() {
  vAlpha = aAlpha;
  vPulseColor = aPulseColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 600.0 / -mvPosition.z;
  gl_PointSize = clamp(gl_PointSize, 2.0, 48.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const PULSE_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vPulseColor;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  vec3 col = vPulseColor * (1.0 + core * 2.0);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// Color for each edge type's pulses
const PULSE_COLORS: Record<string, [number, number, number]> = {
  orbital: [1.0, 0.75, 0.15], // gold
  infrastructure: [0.65, 0.55, 0.95], // purple
  proximity: [0.18, 0.83, 0.75], // teal
  lastmile: [0.3, 0.5, 0.6], // muted blue
};

function NetworkPulses({
  edges,
  focusActive,
}: {
  edges: ConstellationEdge3D[];
  focusActive: boolean;
}) {
  const pulseEdges = useMemo(() => {
    if (edges.length === 0) return [];
    const infra = edges.filter((e) => e.edgeType === 'infrastructure');
    const prox = edges.filter((e) => e.edgeType === 'proximity');

    const selected: ConstellationEdge3D[] = [];
    // Spread across infrastructure edges
    const infraStep = Math.max(1, Math.floor(infra.length / 30));
    for (let i = 0; i < infra.length && selected.length < 50; i += infraStep) {
      selected.push(infra[i]);
    }
    // Fill remaining with proximity
    const proxStep = Math.max(1, Math.floor(prox.length / 20));
    for (let i = 0; i < prox.length && selected.length < PULSE_COUNT; i += proxStep) {
      selected.push(prox[i]);
    }
    return selected;
  }, [edges]);

  const geoRef = useRef<THREE.BufferGeometry>(null);
  const progressRef = useRef<Float32Array>(new Float32Array(PULSE_COUNT));
  // Vary speed per particle for organic feel
  const speedsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    // Staggered start
    for (let i = 0; i < PULSE_COUNT; i++) {
      progressRef.current[i] = i / PULSE_COUNT;
    }
    // Initialize speeds
    if (!speedsRef.current) {
      const s = new Float32Array(PULSE_COUNT);
      for (let i = 0; i < PULSE_COUNT; i++) {
        s[i] = 0.2 + (((i * 7) % 13) / 13) * 0.25; // 0.2–0.45
      }
      speedsRef.current = s;
    }
  }, []);

  useFrame((_, delta) => {
    const geo = geoRef.current;
    if (!geo || pulseEdges.length === 0) return;

    const positions = geo.getAttribute('position') as THREE.BufferAttribute | null;
    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    const colors = geo.getAttribute('aPulseColor') as THREE.BufferAttribute | null;
    if (!positions || !alphas || !colors) return;

    const speeds = speedsRef.current;

    for (let i = 0; i < PULSE_COUNT; i++) {
      const edge = pulseEdges[i % pulseEdges.length];
      const speed = speeds ? speeds[i] : 0.3;
      progressRef.current[i] = (progressRef.current[i] + delta * speed) % 1.0;
      const t = progressRef.current[i];

      positions.setXYZ(
        i,
        edge.from[0] * (1 - t) + edge.to[0] * t,
        edge.from[1] * (1 - t) + edge.to[1] * t,
        edge.from[2] * (1 - t) + edge.to[2] * t,
      );

      const fade = Math.sin(t * Math.PI);
      alphas.setX(i, focusActive ? fade * 0.15 : fade * 0.85);

      const c = PULSE_COLORS[edge.edgeType ?? 'proximity'] ?? PULSE_COLORS.proximity;
      colors.setXYZ(i, c[0], c[1], c[2]);
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;
    colors.needsUpdate = true;
  });

  const buffers = useMemo(() => {
    const positions = new Float32Array(PULSE_COUNT * 3);
    const sizes = new Float32Array(PULSE_COUNT).fill(0.12);
    const alphas = new Float32Array(PULSE_COUNT).fill(0);
    const pulseColors = new Float32Array(PULSE_COUNT * 3).fill(0.5);
    return { positions, sizes, alphas, pulseColors };
  }, []);

  if (pulseEdges.length === 0) return null;

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aPulseColor" args={[buffers.pulseColors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={PULSE_VERT}
        fragmentShader={PULSE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

// --- Matched edge glow (amber energy between matched nodes) ---

function MatchedEdgeGlow({ nodes, focus }: { nodes: ConstellationNode3D[]; focus: FocusState }) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const matchedEdges = useMemo(() => {
    if (focus.focusedIds.size < 2) return null;
    // Build edges between nearby focused nodes (within distance 4)
    const matched = nodes.filter((n) => focus.focusedIds.has(n.id));
    if (matched.length < 2) return null;

    const positions: number[] = [];
    const intensityArr: number[] = [];
    const maxEdges = 80; // cap for performance
    let count = 0;

    for (let i = 0; i < matched.length && count < maxEdges; i++) {
      for (let j = i + 1; j < matched.length && count < maxEdges; j++) {
        const a = matched[i];
        const b = matched[j];
        const dx = a.position[0] - b.position[0];
        const dy = a.position[1] - b.position[1];
        const dz = a.position[2] - b.position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > 4) continue;
        positions.push(...a.position, ...b.position);
        const avg = ((focus.intensities.get(a.id) ?? 0) + (focus.intensities.get(b.id) ?? 0)) / 2;
        intensityArr.push(avg);
        count++;
      }
    }
    if (positions.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return {
      geometry: geo,
      avgIntensity: intensityArr.reduce((a, b) => a + b, 0) / intensityArr.length,
    };
  }, [nodes, focus]);

  useFrame(({ clock }) => {
    if (!matRef.current || !matchedEdges) return;
    const t = clock.getElapsedTime();
    const pulse = 0.05 + matchedEdges.avgIntensity * 0.3 * (0.5 + 0.5 * Math.sin(t * 2));
    matRef.current.opacity = pulse;
  });

  if (!matchedEdges) return null;

  return (
    <lineSegments geometry={matchedEdges.geometry}>
      <lineBasicMaterial
        ref={matRef}
        color={MATCH_COLOR}
        transparent
        opacity={0.1}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

// --- Fly-to particle trail (streams from camera to target on final match) ---

const FLY_PARTICLE_COUNT = 30;

function FlyToParticles({
  target,
  active,
}: {
  target: [number, number, number] | null;
  active: boolean;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const startTimesRef = useRef(new Float32Array(FLY_PARTICLE_COUNT));
  const activatedRef = useRef(false);
  const cameraStartRef = useRef<[number, number, number]>([0, 3, 14]);

  // On activation, capture camera position and stagger start times
  useEffect(() => {
    if (active && target) {
      activatedRef.current = true;
      for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
        startTimesRef.current[i] = -1; // will be set in first frame
      }
    } else {
      activatedRef.current = false;
    }
  }, [active, target]);

  useFrame(({ camera, clock }) => {
    const geo = geoRef.current;
    if (!geo || !target || !activatedRef.current) return;

    const positions = geo.getAttribute('position') as THREE.BufferAttribute | null;
    const alphas = geo.getAttribute('aAlpha') as THREE.BufferAttribute | null;
    if (!positions || !alphas) return;

    const now = clock.getElapsedTime();

    // Capture camera start on first frame
    if (startTimesRef.current[0] < 0) {
      cameraStartRef.current = [camera.position.x, camera.position.y, camera.position.z];
      for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
        startTimesRef.current[i] = now + i * 0.03; // 30ms stagger
      }
    }

    const [sx, sy, sz] = cameraStartRef.current;
    const [tx, ty, tz] = target;
    let anyActive = false;

    for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
      const elapsed = now - startTimesRef.current[i];
      if (elapsed < 0) {
        // Not started yet
        positions.setXYZ(i, sx, sy, sz);
        alphas.setX(i, 0);
        anyActive = true;
        continue;
      }

      const t = Math.min(elapsed / 0.8, 1); // 800ms travel
      // Ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      positions.setXYZ(i, sx + (tx - sx) * eased, sy + (ty - sy) * eased, sz + (tz - sz) * eased);

      // Fade: ramp up then fade out
      const alpha = t < 0.2 ? t / 0.2 : t > 0.7 ? (1 - t) / 0.3 : 1;
      alphas.setX(i, alpha * 0.8);

      if (t < 1) anyActive = true;
    }

    positions.needsUpdate = true;
    alphas.needsUpdate = true;

    // Auto-deactivate when all particles are done
    if (!anyActive) {
      activatedRef.current = false;
    }
  });

  const buffers = useMemo(() => {
    const positions = new Float32Array(FLY_PARTICLE_COUNT * 3);
    const sizes = new Float32Array(FLY_PARTICLE_COUNT).fill(0.06);
    const alphas = new Float32Array(FLY_PARTICLE_COUNT).fill(0);
    const colors = new Float32Array(FLY_PARTICLE_COUNT * 3);
    const matchCol = new THREE.Color(MATCH_COLOR);
    for (let i = 0; i < FLY_PARTICLE_COUNT; i++) {
      colors[i * 3] = matchCol.r * 2.5;
      colors[i * 3 + 1] = matchCol.g * 2.5;
      colors[i * 3 + 2] = matchCol.b * 2.5;
    }
    return { positions, sizes, alphas, colors };
  }, []);

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aAlpha" args={[buffers.alphas, 1]} />
        <bufferAttribute attach="attributes-aPulseColor" args={[buffers.colors, 3]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={PULSE_VERT}
        fragmentShader={PULSE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * GloryRing — Golden torus ring that appears around the #1 match node during reveal.
 * Fades in, gently pulses in scale, and emits golden light via additive blending.
 */
function GloryRing({
  target,
  active,
}: {
  target: [number, number, number] | null;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (active) startTimeRef.current = 0; // reset on activation
  }, [active]);

  useFrame(({ clock }) => {
    if (!meshRef.current || !materialRef.current || !target || !active) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    const mesh = meshRef.current;
    const mat = materialRef.current;

    if (startTimeRef.current === 0) startTimeRef.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startTimeRef.current;

    // Fade in over 0.5s
    const fadeIn = Math.min(elapsed / 0.5, 1);
    // Gentle pulse (0.9-1.1 scale oscillation)
    const pulse = 1 + Math.sin(elapsed * 3) * 0.1;

    mesh.visible = true;
    mesh.position.set(target[0], target[1], target[2]);
    mesh.scale.setScalar(pulse * fadeIn);
    // Face the camera by rotating to be perpendicular to the view direction
    mesh.rotation.x = Math.PI * 0.5 + Math.sin(elapsed * 0.8) * 0.08;
    mesh.rotation.z = elapsed * 0.3;
    mat.opacity = fadeIn * 0.35; // subtle, not overpowering
  });

  return (
    <mesh ref={meshRef} visible={false} frustumCulled={false}>
      <torusGeometry args={[0.4, 0.015, 12, 36]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#f5c542"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// --- Globe rotation group: Y-axis with Earth-like axial tilt ---

/**
 * Subtle camera wobble: gentle oscillation of azimuth angle
 * to make the globe feel alive even when Seneca is idle.
 * Amplitude ~0.0003 rad/frame, period ~12s.
 */
function IdleCameraWobble({
  controlsRef,
}: {
  controlsRef: React.RefObject<CameraControls | null>;
}) {
  useFrame(({ clock }) => {
    if (!controlsRef.current) return;
    const t = clock.getElapsedTime();
    // Gentle azimuth drift
    controlsRef.current.azimuthAngle += Math.sin(t * 0.52) * 0.0002;
  });
  return null;
}

/**
 * CinematicCamera — Per-frame smooth camera motion for theatrical choreography.
 * Continuously orbits at configurable speed and smoothly dolly-zooms to target distance.
 * Only active when orbitSpeed > 0 or dollyTarget differs from current.
 */
function CinematicCamera({
  controlsRef,
  orbitSpeed,
  dollyTarget,
}: {
  controlsRef: React.RefObject<CameraControls | null>;
  orbitSpeed: number;
  dollyTarget: number;
}) {
  const currentDolly = useRef(14);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Smooth orbit: per-frame azimuth accumulation (cinematic takes over from idle wobble)
    if (Math.abs(orbitSpeed) > 0.001) {
      controls.azimuthAngle += orbitSpeed * delta;
    }

    // Smooth dolly: exponential smoothing toward target distance
    const dollyDiff = dollyTarget - currentDolly.current;
    if (Math.abs(dollyDiff) > 0.05) {
      // Frame-rate independent exponential decay: approaches target smoothly
      const factor = 1 - Math.pow(0.05, delta);
      currentDolly.current += dollyDiff * factor;
      controls.dollyTo(currentDolly.current, false);
    }
  });

  return null;
}

function TiltedGlobeGroup({
  rotationRef,
  speedRef,
  breathing,
  urgency,
  children,
}: {
  rotationRef: React.RefObject<number>;
  speedRef: React.RefObject<number>;
  breathing?: boolean;
  urgency?: number;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      // Always advance rotation — speed is 0 during interaction, restored by idle recovery
      rotationRef.current += delta * speedRef.current;

      // Apply axial tilt on X, then spin on Y (local)
      groupRef.current.rotation.x = AXIAL_TILT;
      groupRef.current.rotation.y = rotationRef.current;

      // Breathing: gentle rhythmic scale pulse
      if (breathing) {
        // Heartbeat rate: 8-16 bpm based on urgency (0-100)
        const bpm = 8 + ((urgency ?? 30) / 100) * 8;
        const freq = bpm / 60; // Hz
        const t = clock.getElapsedTime();
        // Double-bump heartbeat shape: two quick pulses then rest
        const phase = (t * freq) % 1;
        const beat =
          phase < 0.1
            ? Math.sin((phase * Math.PI) / 0.1) * 0.003
            : phase < 0.2
              ? Math.sin(((phase - 0.1) * Math.PI) / 0.1) * 0.0015
              : 0;
        const scale = 1 + beat;
        groupRef.current.scale.setScalar(scale);
      }
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// HeartbeatPulse and InnerGlow removed — visually distracting

// --- Helpers ---

function rotateAroundY(pos: [number, number, number], angle: number): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // Also account for axial tilt
  const x1 = pos[0] * c + pos[2] * s;
  const z1 = -pos[0] * s + pos[2] * c;
  // Apply tilt
  const y2 = pos[1] * Math.cos(AXIAL_TILT) - z1 * Math.sin(AXIAL_TILT);
  const z2 = pos[1] * Math.sin(AXIAL_TILT) + z1 * Math.cos(AXIAL_TILT);
  return [x1, y2, z2];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function estimateGPUTier(): 'low' | 'mid' | 'high' {
  if (typeof window === 'undefined') return 'mid';
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return 'low';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase() : '';
  if (/swiftshader|llvmpipe|mesa/i.test(renderer)) return 'low';
  if (window.innerWidth < 768) return 'mid';
  return 'high';
}
