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
import { GlobePostProcessing } from '@/components/globe/GlobePostProcessing';
import { computeGlobeLayout } from '@/lib/constellation/globe-layout';
import { DelegationBond as DelegationBondComponent } from '@/components/globe/DelegationBond';
import { AmbientStarfield } from '@/components/globe/GlobeAmbient';
import { ConstellationLines } from '@/components/globe/GlobeEdges';
import { MatchUserNode } from '@/components/globe/MatchUserNode';
import { MatchedEdgeGlow } from '@/components/globe/MatchedEdgeGlow';
import { FlyToParticles } from '@/components/globe/FlyToParticles';
import { GloryRing } from '@/components/globe/GloryRing';
import { ConvergenceParticles } from '@/components/globe/ConvergenceParticles';
import { ProximityHalo } from '@/components/globe/ProximityHalo';
import { RegionHighlight } from '@/components/globe/RegionHighlight';
import { ConstellationNodes } from '@/components/globe/NodePoints';
import {
  IdleCameraWobble,
  CinematicCamera,
  ConstellationGroup,
} from '@/components/globe/GlobeCamera';
import type { ConstellationApiData, ConstellationNode3D } from '@/lib/constellation/types';

// ConstellationRef is now imported directly from '@/lib/globe/types' by all consumers

import {
  INITIAL_CAMERA,
  INITIAL_TARGET,
  DEFAULT_ROTATION_SPEED,
  DEFAULT_FOCUS,
} from '@/lib/globe/types';
import type { FocusState, SceneState } from '@/lib/globe/types';
import { getSharedFocus, setSharedFocus, getSharedFocusVersion } from '@/lib/globe/focusState';
import { getSharedIntent, getSharedIntentVersion } from '@/lib/globe/focusIntent';
import { deriveFromIntent } from '@/lib/globe/focusEngine';
import { isEngineLocked } from '@/lib/globe/sequencer';
import { estimateGPUTier } from '@/lib/globe/helpers';
import { createConstellationCommands } from '@/lib/globe/constellationCommands';

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
  /** R3F children rendered inside the ConstellationGroup (e.g., Html cluster labels) */
  children?: React.ReactNode;
  /** Set of node IDs that have been visited/inspected this session */
  visitedNodeIds?: Set<string>;
  /** Cluster data for constellation lines (MST within clusters) */
  clusters?: Array<{ memberIds: string[] }>;
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
    clusters,
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

  // Reactive focus engine state
  const lastIntentVersionRef = useRef(0);
  const engineActiveRef = useRef(false);
  const prevEngineDollyRef = useRef(14);

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
  // Keep a ref to current sceneState for imperative commands (avoids stale closures)
  const sceneStateRef = useRef(sceneState);
  sceneStateRef.current = sceneState;

  const [quality, setQuality] = useState<'low' | 'mid' | 'high'>('high');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Bridge focus state into R3F's separate fiber tree.
  // R3F's <Canvas> creates an independent React root — children don't re-render
  // when parent state changes via useState. We store focus in a ref that R3F
  // components read in useFrame, and increment a version counter so useFrame
  // can detect changes without depending on React re-renders.
  //
  // Forward sync: push React-managed focus to shared state, but PRESERVE
  // fields set externally by behaviors (userNode from spatialMatchBehavior).
  // Without this merge, the forward sync clobbers behavior writes before the
  // reverse sync interval can detect them.
  // SKIP when reactive focus engine is active — it writes FocusState directly.
  if (!engineActiveRef.current) {
    const shared = getSharedFocus();
    if (shared !== sceneState.focus) {
      setSharedFocus({
        ...sceneState.focus,
        userNode: shared.userNode ?? sceneState.focus.userNode,
      });
    }
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
        const latest = getSharedFocus();
        // Only sync fields that behaviors set externally (userNode)
        // to avoid overwriting React-managed focus state
        setSceneState((prev) => {
          if (latest.userNode === prev.focus.userNode) return prev;
          return { ...prev, focus: { ...prev.focus, userNode: latest.userNode } };
        });
      }
    }, 50); // Poll at 20Hz — fast enough for visual updates, light on CPU
    return () => clearInterval(interval);
  }, []);

  // Reactive focus engine tick — reads FocusIntent, derives FocusState + camera.
  // Runs at 20Hz. CinematicCamera/CameraControls handle per-frame smooth interpolation.
  useEffect(() => {
    const interval = setInterval(() => {
      // Sequencer lock: when a theatrical sequence (reveal, cleanup) is running,
      // the engine must not process intents — the sequencer owns the globe.
      if (isEngineLocked()) return;

      const intentVersion = getSharedIntentVersion();
      if (intentVersion === lastIntentVersionRef.current) return;
      lastIntentVersionRef.current = intentVersion;

      const intent = getSharedIntent();

      // Null intent = engine idle, yield to legacy commands
      if (intent.focusedIds === null) {
        engineActiveRef.current = false;
        return;
      }

      // Derive FocusState + camera from intent
      const output = deriveFromIntent(
        intent,
        sceneState.nodes,
        rotationAngleRef.current,
        prevEngineDollyRef.current,
      );

      // Write FocusState to React state + window global
      setSceneState((prev) => ({ ...prev, focus: output.focus }));
      setSharedFocus(output.focus);

      // Apply camera if engine derived one and flyToFocus is not disabled
      if (output.camera && intent.flyToFocus !== false) {
        const controls = cameraControlsRef.current;
        if (controls) {
          rotationSpeedRef.current = output.camera.orbitSpeed;
          controls.smoothTime = output.camera.transitionSpeed;
          controls.setLookAt(
            output.camera.position[0],
            output.camera.position[1],
            output.camera.position[2],
            output.camera.target[0],
            output.camera.target[1],
            output.camera.target[2],
            true,
          );
        }
        setCinematicDollyTarget(output.camera.distance);
        prevEngineDollyRef.current = output.camera.distance;
      }

      engineActiveRef.current = true;
    }, 50);
    return () => clearInterval(interval);
    // sceneState.nodes changes when API data loads — engine must re-resolve intents
  }, [sceneState.nodes]);

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

  // Priority 4: Convergence particle source/target positions (derived from focus state)
  const convergenceSourcePositions = useMemo(() => {
    if (!sceneState.focus.convergenceTarget) return [];
    const positions: Array<[number, number, number]> = [];
    for (const node of sceneState.nodes) {
      if (
        sceneState.focus.focusedIds.has(node.id) &&
        node.id !== sceneState.focus.convergenceTarget
      ) {
        positions.push(node.position);
      }
    }
    return positions.slice(0, 20); // Cap at 20 sources
  }, [sceneState.focus.convergenceTarget, sceneState.focus.focusedIds, sceneState.nodes]);

  const convergenceTargetPosition = useMemo((): [number, number, number] | null => {
    if (!sceneState.focus.convergenceTarget) return null;
    const target = sceneState.nodeMap.get(sceneState.focus.convergenceTarget);
    return target?.position ?? null;
  }, [sceneState.focus.convergenceTarget, sceneState.nodeMap]);

  // Priority 4: Cluster memberships for region highlighting
  const clusterMemberships = useMemo(() => {
    // Build from node positions — simple proximity clustering
    // In practice, this would come from the cluster detection module
    return new Map<string, Set<string>>();
  }, []);

  useImperativeHandle(ref, () =>
    createConstellationCommands({
      cameraControlsRef,
      rotationAngleRef,
      rotationSpeedRef,
      cinematicRef,
      engineActiveRef,
      sceneStateRef,
      setSceneState,
      setCinematicOrbitSpeed,
      setCinematicDollyTarget,
      effectiveCamera,
      effectiveTarget,
      onNodeSelectRef,
      onContracted,
    }),
  );

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
  // Track mouse position for hover tooltip positioning + parallax
  const mouseNormalizedRef = useRef({ x: 0, y: 0 });
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    mouseScreenRef.current = { x: e.clientX, y: e.clientY };
    // Normalized to -1..1 for parallax
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseNormalizedRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    };
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

          <AmbientStarfield count={quality === 'low' ? 200 : 500} />
          <ConstellationGroup
            rotationRef={rotationAngleRef}
            speedRef={rotationSpeedRef}
            breathing={breathing && !sceneState.focus.active}
            urgency={urgency}
          >
            {/* Subtle point light at center for depth cues */}
            <pointLight color="#4466aa" intensity={0.8} distance={10} decay={2} />
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
            {/* Intra-cluster constellation lines (MST-based Orion-like patterns) */}
            {clusters && clusters.length > 0 && (
              <ConstellationLines nodes={sceneState.nodes} clusters={clusters} />
            )}
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
              <MatchedEdgeGlow
                nodes={sceneState.nodes}
                focusedNodeIds={sceneState.focus.focusedIds}
                intensities={sceneState.focus.intensities}
                focusColor={sceneState.focus.focusColor}
              />
            )}

            {/* CC members rendered as sentinel nodes within the constellation (no crown ring) */}

            {/* R3F children (e.g., Html cluster labels) — rendered inside the tilted group */}
            {children}

            {/* Priority 4: Proximity halos around focused nodes */}
            {quality !== 'low' && sceneState.focus.haloRadii && (
              <ProximityHalo
                nodes={sceneState.nodes}
                haloRadii={sceneState.focus.haloRadii}
                focusColor={sceneState.focus.focusColor}
              />
            )}

            {/* Priority 4: Region highlighting (convex hulls around clusters) */}
            {sceneState.focus.highlightedRegions && (
              <RegionHighlight
                nodes={sceneState.nodes}
                highlightedRegions={sceneState.focus.highlightedRegions}
                clusterMemberships={clusterMemberships}
                color={sceneState.focus.focusColor}
              />
            )}

            {/* Match-derived user node (spatial match reveal — Chunk 3) */}
            {sceneState.focus.userNode && (
              <MatchUserNode
                position={sceneState.focus.userNode.position}
                intensity={sceneState.focus.userNode.intensity}
              />
            )}
          </ConstellationGroup>

          {quality !== 'low' && (
            <FlyToParticles target={sceneState.flyToTarget} active={sceneState.flyToActive} />
          )}
          <GloryRing target={sceneState.flyToTarget} active={sceneState.flyToActive} />

          {/* Priority 4: Convergence particles — focused nodes stream toward target */}
          {quality !== 'low' && sceneState.focus.convergenceTarget && (
            <ConvergenceParticles
              sourcePositions={convergenceSourcePositions}
              targetPosition={convergenceTargetPosition}
              active={!!sceneState.focus.convergenceTarget}
            />
          )}

          <GlobePostProcessing
            quality={quality}
            bloomIntensity={sceneState.focus.bloomIntensity}
            overlayColorMode={overlayColorMode}
          />

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
            driftEnabled={sceneState.focus.driftEnabled}
            mouseRef={mouseNormalizedRef}
          />
        </Canvas>
      )}
    </div>
  );
});

// Node and SPO shaders imported from lib/globe/shaders.ts
// ConstellationNodes + NodePoints extracted to components/globe/NodePoints.tsx
// IdleCameraWobble, CinematicCamera, ConstellationGroup imported at top of file
