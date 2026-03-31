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
import { Canvas } from '@react-three/fiber';
import { useGovernanceConstellation } from '@/hooks/queries';
import { CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { computeGlobeLayout } from '@/lib/constellation/globe-layout';
import { DelegationBond as DelegationBondComponent } from '@/components/globe/DelegationBond';
import { GlobeAtmosphere } from '@/components/globe/GlobeAtmosphere';
import { AmbientStarfield } from '@/components/globe/GlobeAmbient';
import { MatchUserNode } from '@/components/globe/MatchUserNode';
import { NetworkEdgeLines, ConstellationEdges, NeuralMesh } from '@/components/globe/GlobeEdges';
import {
  NetworkPulses,
  MatchedEdgeGlow,
  FlyToParticles,
  GloryRing,
} from '@/components/globe/GlobeEffects';
import { ConstellationNodes } from '@/components/globe/NodePoints';
import {
  IdleCameraWobble,
  CinematicCamera,
  TiltedGlobeGroup,
} from '@/components/globe/GlobeCamera';
import type {
  ConstellationApiData,
  FindMeTarget,
  ConstellationNode3D,
} from '@/lib/constellation/types';

// ConstellationRef is now imported directly from '@/lib/globe/types' by all consumers

import {
  INITIAL_CAMERA,
  INITIAL_TARGET,
  DEFAULT_ROTATION_SPEED,
  DEFAULT_FOCUS,
} from '@/lib/globe/types';
import type { FocusState, SceneState } from '@/lib/globe/types';
import { getSharedFocus, setSharedFocus, getSharedFocusVersion } from '@/lib/globe/focusState';
import { rotateAroundY, sleep, estimateGPUTier } from '@/lib/globe/helpers';

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
  /** R3F children rendered inside the TiltedGlobeGroup (e.g., Html cluster labels) */
  children?: React.ReactNode;
  /** Set of node IDs that have been visited/inspected this session */
  visitedNodeIds?: Set<string>;
}

// FocusState, SceneState, constants, and focus bridge functions are now imported from lib/globe/

export const GlobeConstellation = forwardRef<
  import('@/lib/globe/types').ConstellationRef,
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
    children,
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

  // Reverse sync: detect when behaviors (e.g., spatialMatchBehavior) write to
  // shared focus externally (userNode, etc.) and pull those changes into React
  // state so JSX components like MatchUserNode can render.
  const sharedFocusVersionRef = useRef(getSharedFocusVersion());
  useEffect(() => {
    const interval = setInterval(() => {
      const currentVersion = getSharedFocusVersion();
      if (currentVersion !== sharedFocusVersionRef.current) {
        sharedFocusVersionRef.current = currentVersion;
        const shared = getSharedFocus();
        // Only sync fields that behaviors set externally (userNode)
        // to avoid overwriting React-managed focus state
        if (shared.userNode !== sceneState.focus.userNode) {
          setSceneState((prev) => ({
            ...prev,
            focus: { ...prev.focus, userNode: shared.userNode },
          }));
        }
      }
    }, 100); // Poll at 10Hz — fast enough for visual updates, light on CPU
    return () => clearInterval(interval);
  }, [sceneState.focus.userNode]);

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

      // Intermediate "maybe" nodes and scanning sweep activation delays
      const intermediateIds = new Map<string, number>();
      const activationDelays = new Map<string, number>();

      if (options?.topN && options.topN > 0) {
        // Top-N mode: rank by distance, take the closest N
        scored.sort((a, b) => a.distance - b.distance);
        const maxDist = scored[Math.min(options.topN, scored.length) - 1]?.distance ?? 1;
        for (let i = 0; i < Math.min(options.topN, scored.length); i++) {
          matched.add(scored[i].id);
          intensities.set(scored[i].id, Math.max(0.2, 1 - scored[i].distance / (maxDist * 1.2)));
        }

        // "Maybe" nodes: ranked topN+1 through topN*2 glow faintly
        const maybeEnd = Math.min(options.topN * 2, scored.length);
        for (let i = options.topN; i < maybeEnd; i++) {
          const level = 0.1 + 0.4 * (1 - (i - options.topN) / (maybeEnd - options.topN));
          intermediateIds.set(scored[i].id, level);
        }

        // Scanning sweep: nodes activate by rank — best matches first
        const SWEEP_DURATION = 0.6; // seconds for the entire sweep
        for (let i = 0; i < scored.length; i++) {
          activationDelays.set(scored[i].id, (i / scored.length) * SWEEP_DURATION);
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
          activationDelays: activationDelays.size > 0 ? activationDelays : null,
          intermediateIds: intermediateIds.size > 0 ? intermediateIds : null,
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

          // Progressive orbit slowing — nearly stops by final round
          const sp = options?.scanProgressOverride ?? 0;
          rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * Math.max(0.05, 0.4 - sp * 0.35);

          // Camera pulls closer as the cluster narrows — funneling toward the match
          // Uses scanProgress (0.15→0.95) not threshold, which is always 9999 in topN mode
          const camDist = 13 - sp * 5; // 12.25 (Q1) → 11 (Q2) → 9.5 (Q3) → 8.25 (Q4)

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

          // Progressive camera smoothTime: slower approach early, faster convergence later
          // Round 0 (sp≈0.15): 1.5s, Round 1 (sp≈0.4): 1.2s, Round 2 (sp≈0.7): 0.9s, Round 3 (sp≈0.95): 0.8s
          const controls = cameraControlsRef.current;
          controls.smoothTime = Math.max(0.8, 1.5 - sp * 0.8);
          controls.setLookAt(camX, camY, camZ, cx * 0.7, cy * 0.7, cz * 0.7, true);
          // Sync dolly rig to match setLookAt distance — prevents CinematicCamera fighting setLookAt
          setCinematicDollyTarget(camDist);
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
      // Final "locking on" — fly to the top match node cinematically
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

      // Set #1 match to gold + max intensity
      setSceneState((prev) => {
        const newFocusedIds = new Set(prev.focus.focusedIds);
        newFocusedIds.add(drepId);
        const newIntensities = new Map(prev.focus.intensities);
        newIntensities.set(drepId, 1.0);
        const newColors = new Map(prev.focus.colorOverrides ?? []);
        newColors.set(drepId, '#fbbf24'); // gold
        return {
          ...prev,
          pulseId: drepId,
          animating: true,
          flyToTarget: [x, y, z],
          flyToActive: true,
          focus: {
            ...prev.focus,
            focusedIds: newFocusedIds,
            intensities: newIntensities,
            colorOverrides: newColors,
          },
        };
      });

      // Camera positioned along node's outward normal — dead center on screen
      const camDist = Math.max(dist * 1.8, 8);

      // Slow cinematic approach: smoothTime 1.5 = slow start, accelerating, smooth arrival
      const controls = cameraControlsRef.current;
      controls.smoothTime = 1.5;
      await controls.setLookAt(nx * camDist, ny * camDist, nz * camDist, x, y, z, true);

      // Lock-on tightening: responsive micro-corrections during hold
      controls.smoothTime = 0.4;

      // Micro-orbit during 3-second hold — scene feels alive, not frozen
      if (cinematicRef.current) {
        cinematicRef.current.orbitSpeed = 0.003;
        cinematicRef.current.active = true;
      }

      // Hold the dramatic lock — the "Cerebro found you" moment
      await sleep(3000);

      // End micro-orbit
      if (cinematicRef.current) {
        cinematicRef.current.orbitSpeed = 0;
        cinematicRef.current.active = false;
      }

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
      // "Entering Cerebro" — light up all DRep nodes with shockwave propagation
      const drepIds = new Set<string>();
      const intensities = new Map<string, number>();
      const activationDelays = new Map<string, number>();

      // Compute radial distances for shockwave effect
      let maxDist = 0;
      const drepDistances: Array<{ id: string; dist: number }> = [];
      for (const node of sceneState.nodes) {
        if (node.nodeType === 'drep') {
          drepIds.add(node.id);
          intensities.set(node.id, 0.6); // warm glow, not max intensity
          const [x, y, z] = node.position;
          const dist = Math.sqrt(x * x + y * y + z * z);
          drepDistances.push({ id: node.id, dist });
          if (dist > maxDist) maxDist = dist;
        }
      }

      // Map radial distance to activation delay: inner nodes first, outer nodes last
      // 0.3s total wave propagation — fast enough that all nodes are lit before Q1 is read
      const WAVE_DURATION = 0.3;
      for (const { id, dist } of drepDistances) {
        const normalizedDist = maxDist > 0 ? dist / maxDist : 0;
        activationDelays.set(id, normalizedDist * WAVE_DURATION);
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
          activationDelays,
          intermediateIds: null,
        },
        flyToTarget: null,
        flyToActive: false,
      }));

      // Slow rotation to "scanning" pace
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * 0.6;

      // Shift camera left for Seneca panel, close enough to see DRep nodes
      if (cameraControlsRef.current) {
        cameraControlsRef.current.setLookAt(-2, 1.5, 13, -1, 0, 0, true);
      }
      setCinematicDollyTarget(13);
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
          activationDelays: null,
          intermediateIds: null,
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
          activationDelays: null,
          intermediateIds: null,
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
          activationDelays: null,
          intermediateIds: null,
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
          activationDelays: null,
          intermediateIds: null,
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
      // Flash: pulse scale + illuminate the node with gold color override + full intensity
      setSceneState((prev) => {
        const newFocusedIds = new Set(prev.focus.focusedIds);
        newFocusedIds.add(nodeId);
        const newIntensities = new Map(prev.focus.intensities);
        newIntensities.set(nodeId, 1.0);
        const newColors = new Map(prev.focus.colorOverrides ?? []);
        newColors.set(nodeId, '#fbbf24'); // gold flash
        return {
          ...prev,
          pulseId: nodeId,
          focus: {
            ...prev.focus,
            focusedIds: newFocusedIds,
            intensities: newIntensities,
            colorOverrides: newColors,
          },
        };
      });
      setTimeout(() => setSceneState((prev) => ({ ...prev, pulseId: null })), 600);
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

    flyToPosition: async (target, options) => {
      const controls = cameraControlsRef.current;
      if (!controls) return;

      const [tx, ty, tz] = rotateAroundY(target, rotationAngleRef.current);
      const dist = options?.distance ?? 12;

      // Camera on outward normal from origin through target
      const len = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      const camX = (tx / len) * dist;
      const camY = (ty / len) * dist + 1.5;
      const camZ = (tz / len) * dist;

      controls.smoothTime = options?.duration ?? 1.2;
      setSceneState((prev) => ({ ...prev, animating: true }));
      await controls.setLookAt(camX, camY, camZ, tx * 0.7, ty * 0.7, tz * 0.7, true);
      setCinematicDollyTarget(dist);
      setTimeout(
        () => {
          if (cameraControlsRef.current) cameraControlsRef.current.smoothTime = 0.8;
          setSceneState((prev) => ({ ...prev, animating: false }));
        },
        (options?.duration ?? 1.2) * 1000 + 200,
      );
    },

    narrowTo: (nodeIds, options) => {
      if (!nodeIds.length) return;

      const matched = new Set(nodeIds);
      const intensities = new Map<string, number>();
      let cx = 0,
        cy = 0,
        cz = 0,
        count = 0;

      for (const node of sceneState.nodes) {
        if (matched.has(node.id)) {
          intensities.set(node.id, 1.0);
          const [rx, ry, rz] = rotateAroundY(node.position, rotationAngleRef.current);
          cx += rx;
          cy += ry;
          cz += rz;
          count++;
        }
      }

      const dimOthers = options?.dimOthers ?? true;
      const sp = options?.scanProgress ?? 0.7;

      setSceneState((prev) => ({
        ...prev,
        focus: {
          active: true,
          focusedIds: matched,
          intensities,
          scanProgress: dimOthers ? sp : 0,
          colorOverrides: null,
          nodeTypeFilter: null,
          activationDelays: null,
          intermediateIds: null,
        },
      }));

      // Fly to centroid of specified nodes
      const fly = options?.fly ?? true;
      if (fly && count > 0 && cameraControlsRef.current) {
        cx /= count;
        cy /= count;
        cz /= count;
        const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
        const nx = cx / dir;
        const ny = cy / dir;
        const nz = cz / dir;

        rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * Math.max(0.05, 0.4 - sp * 0.35);

        const camDist = 13 - sp * 5;
        let camX = nx * camDist;
        let camY = ny * camDist + 1.5;
        let camZ = nz * camDist;

        if (options?.cameraAngle) {
          const cos = Math.cos(options.cameraAngle);
          const sin = Math.sin(options.cameraAngle);
          const rx2 = camX * cos - camZ * sin;
          const rz2 = camX * sin + camZ * cos;
          camX = rx2;
          camZ = rz2;
        }
        if (options?.cameraElevation) {
          camY += camDist * Math.sin(options.cameraElevation);
        }

        const controls = cameraControlsRef.current;
        controls.smoothTime = Math.max(0.8, 1.5 - sp * 0.8);
        controls.setLookAt(camX, camY, camZ, cx * 0.7, cy * 0.7, cz * 0.7, true);
        setCinematicDollyTarget(camDist);
        setTimeout(() => {
          if (cameraControlsRef.current) cameraControlsRef.current.smoothTime = 0.8;
        }, 1500);
      }
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
            {/* Hide edges during match mode — they create a starburst that masks node dots */}
            {sceneState.focus.nodeTypeFilter !== 'drep' && (
              <ConstellationEdges edges={sceneState.edges} focusActive={sceneState.focus.active} />
            )}
            {quality !== 'low' && sceneState.focus.nodeTypeFilter !== 'drep' && (
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
            {quality !== 'low' && sceneState.focus.nodeTypeFilter !== 'drep' && (
              <MatchedEdgeGlow nodes={sceneState.nodes} focus={sceneState.focus} />
            )}
            {quality !== 'low' && sceneState.focus.nodeTypeFilter !== 'drep' && (
              <NetworkPulses edges={sceneState.edges} focusActive={sceneState.focus.active} />
            )}

            {/* CC members rendered as sentinel nodes within the constellation (no crown ring) */}

            {/* R3F children (e.g., Html cluster labels) — rendered inside the tilted group */}
            {children}

            {/* Match-derived user node (spatial match reveal — Chunk 3) */}
            {sceneState.focus.userNode && (
              <MatchUserNode
                position={sceneState.focus.userNode.position}
                intensity={sceneState.focus.userNode.intensity}
              />
            )}
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
                  // Match mode: reduce bloom so 800 DRep nodes stay individually distinct,
                  // not merged into one orange wash. Per-node emissive is also reduced to match.
                  sceneState.focus.nodeTypeFilter === 'drep'
                    ? 0.3
                    : overlayColorMode === 'urgent'
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

// GlobeWireframe removed — the latitude lines (especially the equator ring) were visually
// distracting and didn't clearly convey meaning. The atmosphere shells and node positions
// provide sufficient spatial reference.

// Node and SPO shaders imported from lib/globe/shaders.ts

// NetworkEdgeLines, EdgeLayer, ConstellationEdges, NeuralMesh extracted to components/globe/GlobeEdges.tsx

// ConstellationNodes + NodePoints extracted to components/globe/NodePoints.tsx
// IdleCameraWobble, CinematicCamera, TiltedGlobeGroup imported at top of file
