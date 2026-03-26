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
import { CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { computeGlobeLayout } from '@/lib/constellation/globe-layout';
import { DelegationBond as DelegationBondComponent } from '@/components/globe/DelegationBond';
import type {
  ConstellationApiData,
  FindMeTarget,
  ConstellationNode3D,
  ConstellationEdge3D,
} from '@/lib/constellation/types';

export type { ConstellationRef } from '@/components/GovernanceConstellation';

const DREP_COLOR = '#2dd4bf';
const SPO_COLOR = '#a78bfa'; // purple — visually distinct from teal DReps
const CC_COLOR = '#fbbf24';
const USER_COLOR = '#f0e6d0'; // warm white-gold — personal, clearly "you"
const PROPOSAL_COLOR = '#e8dfd0'; // warm white — governance-neutral
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
}

interface SceneState {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  animating: boolean;
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
  scanProgress: number; // 0-1, derived from matching threshold convergence
  flyToTarget: [number, number, number] | null;
  flyToActive: boolean;
}

// Earth-like axial tilt: 23.4 degrees
const AXIAL_TILT = 23.4 * (Math.PI / 180);
const INITIAL_CAMERA: [number, number, number] = [0, 3, 14];
const INITIAL_TARGET: [number, number, number] = [0, 0, 0];
const DEFAULT_ROTATION_SPEED = 0.012; // slow, majestic rotation (~8.7 min/revolution)

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
  },
  ref,
) {
  const cameraControlsRef = useRef<CameraControls>(null);
  const rotationAngleRef = useRef(0);
  const rotationSpeedRef = useRef(DEFAULT_ROTATION_SPEED);
  const userFlyInDone = useRef(false);
  const [ready, setReady] = useState(false);

  // Effective camera position/target — allow overrides from props
  const effectiveCamera = useMemo(
    () => initialCameraPosition ?? INITIAL_CAMERA,
    [initialCameraPosition],
  );
  const effectiveTarget = useMemo(
    () => initialCameraTarget ?? INITIAL_TARGET,
    [initialCameraTarget],
  );

  // --- Interaction state: click-vs-drag disambiguation + auto-rotation pause ---
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDownTimeRef = useRef(0);
  const isDraggingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /** Timestamp of last user interaction — used by useFrame-based idle recovery */
  const lastInteractionRef = useRef(0);
  const [sceneState, setSceneState] = useState<SceneState>({
    nodes: [],
    edges: [],
    nodeMap: new Map(),
    highlightId: null,
    dimmed: false,
    pulseId: null,
    animating: false,
    matchedNodeIds: new Set(),
    matchIntensities: new Map(),
    scanProgress: 0,
    flyToTarget: null,
    flyToActive: false,
  });
  const [quality, setQuality] = useState<'low' | 'mid' | 'high'>('high');

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
    const now = Date.now(); // eslint-disable-line react-hooks/purity -- timestamp for freshness calc
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
    if (!node || node.isAnchor) return null;

    setSceneState((prev) => ({ ...prev, animating: true, highlightId: node.id, dimmed: true }));

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
          highlightId: '__user__',
          dimmed: true,
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

      setSceneState((prev) => ({ ...prev, highlightId: drepId, dimmed: true }));

      const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
      await controls.setLookAt(x * 1.5, y * 1.5, z * 1.5 + 3, x, y, z, true);
      await sleep(2000);

      setSceneState((prev) => ({ ...prev, highlightId: null, dimmed: false }));
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
        highlightId: null,
        dimmed: false,
        animating: false,
      }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
    },

    highlightMatches: (
      userAlignment: number[],
      threshold: number,
      options?: { noZoom?: boolean; zoomToCluster?: boolean },
    ) => {
      const matched = new Set<string>();
      const intensities = new Map<string, number>();

      for (const node of sceneState.nodes) {
        if (node.isAnchor) continue;
        // 6D Euclidean distance
        let sumSq = 0;
        for (let d = 0; d < 6; d++) {
          const diff = (userAlignment[d] ?? 50) - (node.alignments[d] ?? 50);
          sumSq += diff * diff;
        }
        const distance = Math.sqrt(sumSq);

        if (distance < threshold) {
          matched.add(node.id);
          intensities.set(node.id, Math.max(0, Math.min(1, 1 - distance / threshold)));
        }
      }

      // Compute scanning progress from threshold (160=start, 35=end)
      const scanProgress = Math.max(0, Math.min(1, (160 - threshold) / 125));

      setSceneState((prev) => ({
        ...prev,
        matchedNodeIds: matched,
        matchIntensities: intensities,
        dimmed: matched.size > 0,
        scanProgress,
      }));

      // Q1-Q2: highlight only, no camera movement. Slight rotation slowdown.
      if (options?.noZoom) {
        const zoomFactor = Math.max(0, Math.min(1, (160 - threshold) / 125));
        rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * (1 - zoomFactor * 0.3);
        return;
      }

      // Q3: rotate globe to face matching cluster and zoom moderately
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

          // Stop rotation, zoom to moderate distance
          rotationSpeedRef.current = 0;
          const camDist = 10;
          cameraControlsRef.current.setLookAt(
            nx * camDist,
            ny * camDist + 1,
            nz * camDist + 2,
            cx * 0.5,
            cy * 0.5,
            cz * 0.5,
            false,
          );
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
          const camDist = 13 - zoomFactor * 7;
          const lookWeight = 0.3 + zoomFactor * 0.4;
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
            false,
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

      // Fly to the node — position camera outside the globe looking at the node
      // Camera at ~1.8x node distance, offset slightly above for drama
      const camDist = Math.max(dist * 1.8, 8);

      // Smooth cinematic fly-in (false = animate, not instant)
      await cameraControlsRef.current.setLookAt(
        nx * camDist,
        ny * camDist + 1.5,
        nz * camDist + 2,
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

    clearMatches: () => {
      setSceneState((prev) => ({
        ...prev,
        matchedNodeIds: new Set(),
        matchIntensities: new Map(),
        dimmed: false,
        scanProgress: 0,
        flyToTarget: null,
        flyToActive: false,
      }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
      cameraControlsRef.current?.setLookAt(...effectiveCamera, ...effectiveTarget, true);
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
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive) return;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      pointerDownTimeRef.current = Date.now();
      isDraggingRef.current = false;
      lastInteractionRef.current = Date.now();

      // Pause auto-rotation while user is interacting
      rotationSpeedRef.current = 0;
    },
    [interactive],
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive) return;
      mouseScreenRef.current = { x: e.clientX, y: e.clientY };
      lastInteractionRef.current = Date.now();

      // Detect drag: if moved more than 5px from pointer-down, mark as dragging
      const down = pointerDownPosRef.current;
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (dx * dx + dy * dy > 25) {
          isDraggingRef.current = true;
        }
      }
    },
    [interactive],
  );

  const handleCanvasPointerUp = useCallback(() => {
    if (!interactive) return;
    pointerDownPosRef.current = null;
    lastInteractionRef.current = Date.now();
  }, [interactive]);

  const handleCanvasDoubleClick = useCallback(() => {
    if (!interactive) return;
    const controls = cameraControlsRef.current;
    if (!controls) return;
    lastInteractionRef.current = Date.now();
    const dist = controls.distance;
    if (dist < 12) {
      // Zoomed in — reset to default
      controls.setLookAt(...effectiveCamera, ...effectiveTarget, true);
      setSceneState((prev) => ({ ...prev, highlightId: null, dimmed: false }));
      rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
    } else {
      // At default — zoom in
      controls.dolly(4, true);
    }
  }, [interactive, effectiveCamera, effectiveTarget]);

  // Cleanup idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`relative z-0 w-full ${className || ''}`}
      style={{ background: '#0a0b14' }}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onDoubleClick={handleCanvasDoubleClick}
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
            pointerEvents: interactive ? 'auto' : 'none',
          }}
          role="img"
          aria-label="Interactive 3D globe visualization of Cardano governance"
        >
          <color attach="background" args={['#0a0b14']} />
          <ambientLight intensity={0.05} />

          <AmbientStarfield count={quality === 'low' ? 200 : 400} />
          <IdleRotationRecovery
            speedRef={rotationSpeedRef}
            lastInteractionRef={lastInteractionRef}
            interactive={interactive}
          />
          <TiltedGlobeGroup
            rotationRef={rotationAngleRef}
            speedRef={rotationSpeedRef}
            breathing={breathing && !sceneState.dimmed}
            urgency={urgency}
          >
            {/* Subtle point light at center (no visible sphere) */}
            <pointLight color="#4466aa" intensity={0.8} distance={10} decay={2} />
            <GlobeAtmosphere
              radius={8.1}
              color="#4488cc"
              warmColor="#cc8844"
              intensity={0.4}
              matchProgress={
                sceneState.scanProgress > 0 ? sceneState.scanProgress : healthProgress * 0.3
              }
            />
            {/* Wireframe removed — the latitude lines (especially equator) were visually distracting */}
            <ConstellationNodes
              nodes={sceneState.nodes}
              highlightId={sceneState.highlightId}
              dimmed={sceneState.dimmed}
              pulseId={sceneState.pulseId}
              interactive={interactive}
              onNodeClick={
                interactive
                  ? (node) => {
                      if (isDraggingRef.current) return; // suppress click after drag
                      flyToNodeImpl(node.id);
                    }
                  : undefined
              }
              onNodeHover={
                interactive
                  ? (node) => {
                      onNodeHoverRef.current?.(node);
                      onNodeHoverScreenRef.current?.(
                        node,
                        node ? { ...mouseScreenRef.current } : null,
                      );
                    }
                  : undefined
              }
              matchedNodeIds={sceneState.matchedNodeIds}
              matchIntensities={sceneState.matchIntensities}
              activityMap={activityMap}
            />
            <ConstellationEdges edges={sceneState.edges} dimmed={sceneState.dimmed} />
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
                matchedNodeIds={sceneState.matchedNodeIds}
                matchIntensities={sceneState.matchIntensities}
              />
            )}
            {quality !== 'low' && (
              <NetworkPulses edges={sceneState.edges} dimmed={sceneState.dimmed} />
            )}
          </TiltedGlobeGroup>

          {quality !== 'low' && (
            <FlyToParticles target={sceneState.flyToTarget} active={sceneState.flyToActive} />
          )}

          {/* HeartbeatPulse removed — the expanding ring was visually distracting */}

          {quality !== 'low' && (
            <EffectComposer>
              <Bloom
                mipmapBlur
                intensity={1.6}
                luminanceThreshold={0.15}
                luminanceSmoothing={0.9}
                radius={0.95}
              />
            </EffectComposer>
          )}

          <CameraControls
            ref={cameraControlsRef}
            makeDefault
            smoothTime={0.8}
            mouseButtons={
              interactive
                ? {
                    left: 1 as const, // ACTION.ROTATE
                    middle: 0 as const,
                    right: 0 as const,
                    wheel: 16 as const, // ACTION.DOLLY
                  }
                : { left: 0 as const, middle: 0 as const, right: 0 as const, wheel: 0 as const }
            }
            touches={
              interactive
                ? {
                    one: 64 as const, // ACTION.TOUCH_ROTATE
                    two: 1024 as const, // ACTION.TOUCH_DOLLY
                    three: 0 as const,
                  }
                : { one: 0 as const, two: 0 as const, three: 0 as const }
            }
            minPolarAngle={Math.PI / 2 - 0.785}
            maxPolarAngle={Math.PI / 2 + 0.785}
            minDistance={8}
            maxDistance={22}
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

void main() {
  vColor = aNodeColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * 600.0 / -mvPosition.z;
  gl_PointSize = clamp(gl_PointSize, 1.0, 128.0);
  vAlpha = aDimmed < 0.5 ? 1.0 : 0.15;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const NODE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  vec3 col = vColor * (1.0 + core * 1.5);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// Diamond-shaped fragment shader for SPO infrastructure nodes
const SPO_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  // Diamond (rotated square) distance: |x| + |y|
  float diamond = abs(p.x) + abs(p.y);
  if (diamond > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, diamond);
  float core = 1.0 - smoothstep(0.0, 0.15, diamond);
  vec3 col = vColor * (1.0 + core * 2.0);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// Soft wide-glow shader for CC orbital nodes (warm diffused presence)
const CC_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) discard;
  float glow = 1.0 - smoothstep(0.0, 0.5, dist);
  float core = 1.0 - smoothstep(0.0, 0.2, dist);
  vec3 col = vColor * (1.0 + core * 1.5);
  gl_FragColor = vec4(col, glow * vAlpha);
}
`;

// --- Scene sub-components ---

function RaycastConfig() {
  const raycaster = useThree((s) => s.raycaster);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- Three.js raycaster params must be mutated directly
    raycaster.params.Points = { threshold: 0.35 };
  }, [raycaster]);
  return null;
}

function ConstellationNodes({
  nodes,
  highlightId,
  dimmed,
  pulseId,
  interactive,
  onNodeClick,
  onNodeHover,
  matchedNodeIds,
  matchIntensities,
  activityMap,
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
  activityMap?: Map<string, number>;
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
      if (n.isAnchor) continue;
      if (n.nodeType === 'spo') spo.push(n);
      else if (n.nodeType === 'cc') cc.push(n);
      else drep.push(n);
    }
    return { drep, spo, cc, user, proposal };
  }, [nodes]);

  const getDrepColor = useCallback(() => DREP_COLOR, []);
  const getSpoColor = useCallback(() => SPO_COLOR, []);
  const getCcColor = useCallback(() => CC_COLOR, []);
  const getUserColor = useCallback(() => USER_COLOR, []);
  const getProposalColor = useCallback(() => PROPOSAL_COLOR, []);

  if (nodes.length === 0 || !frameReady) return null;

  return (
    <>
      {interactive && <RaycastConfig />}
      <NodePoints
        nodes={groups.drep}
        highlightId={highlightId}
        dimmed={dimmed}
        pulseId={pulseId}
        interactive={interactive}
        onNodeClick={onNodeClick}
        onNodeHover={onNodeHover}
        getColor={getDrepColor}
        emissive={2.0}
        matchedNodeIds={matchedNodeIds}
        matchIntensities={matchIntensities}
        activityMap={activityMap}
      />
      {groups.spo.length > 0 && (
        <NodePoints
          nodes={groups.spo}
          highlightId={highlightId}
          dimmed={dimmed}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getSpoColor}
          emissive={2.0}
          fragmentShader={SPO_FRAG}
          matchedNodeIds={matchedNodeIds}
          matchIntensities={matchIntensities}
          activityMap={activityMap}
        />
      )}
      {groups.cc.length > 0 && (
        <NodePoints
          nodes={groups.cc}
          highlightId={highlightId}
          dimmed={dimmed}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getCcColor}
          emissive={3.5}
          fragmentShader={CC_FRAG}
          matchedNodeIds={matchedNodeIds}
          matchIntensities={matchIntensities}
          activityMap={activityMap}
        />
      )}
      {groups.user.length > 0 && (
        <NodePoints
          nodes={groups.user}
          highlightId={highlightId}
          dimmed={false}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getUserColor}
          emissive={6.0}
          matchedNodeIds={matchedNodeIds}
          matchIntensities={matchIntensities}
          activityMap={activityMap}
        />
      )}
      {groups.proposal.length > 0 && (
        <NodePoints
          nodes={groups.proposal}
          highlightId={highlightId}
          dimmed={dimmed}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
          getColor={getProposalColor}
          emissive={2.5}
          matchedNodeIds={matchedNodeIds}
          matchIntensities={matchIntensities}
          activityMap={activityMap}
        />
      )}
    </>
  );
}

function NodePoints({
  nodes,
  highlightId,
  dimmed,
  pulseId,
  interactive,
  onNodeClick,
  onNodeHover,
  getColor,
  emissive,
  fragmentShader,
  matchedNodeIds,
  matchIntensities,
  activityMap,
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  onNodeHover?: (node: ConstellationNode3D | null) => void;
  getColor: (node: ConstellationNode3D) => string;
  emissive: number;
  fragmentShader?: string;
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
  activityMap?: Map<string, number>;
}) {
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const matchColor = useMemo(() => new THREE.Color(MATCH_COLOR), []);

  const buffers = useMemo(() => {
    const count = nodes.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const dimmedArr = new Float32Array(count);
    const matchingActive = matchedNodeIds.size > 0;

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      positions[i * 3] = node.position[0];
      positions[i * 3 + 1] = node.position[1];
      positions[i * 3 + 2] = node.position[2];

      const isHighlighted = highlightId === node.id;
      const isPulsing = pulseId === node.id;
      const isMatched = matchedNodeIds.has(node.id);
      const matchIntensity = matchIntensities.get(node.id) ?? 0;

      // COLOR: lerp toward MATCH_COLOR when matched, boost emissive for glow
      tmpColor.set(getColor(node));
      if (isMatched && matchingActive) {
        const origR = tmpColor.r;
        const origG = tmpColor.g;
        const origB = tmpColor.b;
        const blend = matchIntensity * 0.85;
        const blendedR = origR + (matchColor.r - origR) * blend;
        const blendedG = origG + (matchColor.g - origG) * blend;
        const blendedB = origB + (matchColor.b - origB) * blend;
        // Boost emissive for high-intensity matches — drives stronger bloom glow
        const matchEmissive = emissive * (1 + matchIntensity * 1.2);
        colors[i * 3] = blendedR * matchEmissive;
        colors[i * 3 + 1] = blendedG * matchEmissive;
        colors[i * 3 + 2] = blendedB * matchEmissive;
      } else {
        // Activity-based brightness: recently active nodes glow brighter
        const activity = activityMap?.get(node.id) ?? activityMap?.get(node.fullId) ?? 0;
        const activityBoost = 1 + activity * 0.8; // up to 1.8x brighter
        colors[i * 3] = tmpColor.r * emissive * activityBoost;
        colors[i * 3 + 1] = tmpColor.g * emissive * activityBoost;
        colors[i * 3 + 2] = tmpColor.b * emissive * activityBoost;
      }

      // SIZE: matched nodes grow more dramatically with intensity
      const baseSize = isPulsing ? node.scale * 1.8 : isHighlighted ? node.scale * 1.5 : node.scale;
      sizes[i] = (isMatched ? baseSize * (1 + 0.5 * matchIntensity) : baseSize) * POINT_SCALE;

      // DIMMED: non-matched dim when matching is active
      dimmedArr[i] =
        matchingActive && !isMatched && !isHighlighted && !isPulsing
          ? 1.0
          : dimmed && !isHighlighted && !isPulsing
            ? 1.0
            : 0.0;
    }

    return { positions, colors, sizes, dimmedArr };
  }, [
    nodes,
    highlightId,
    dimmed,
    pulseId,
    getColor,
    emissive,
    tmpColor,
    matchedNodeIds,
    matchIntensities,
    matchColor,
    activityMap,
  ]);

  const geoRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(buffers.positions, 3));
    geo.setAttribute('aNodeColor', new THREE.Float32BufferAttribute(buffers.colors, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(buffers.sizes, 1));
    geo.setAttribute('aDimmed', new THREE.Float32BufferAttribute(buffers.dimmedArr, 1));
    geo.computeBoundingSphere();
  }, [buffers]);

  if (nodes.length === 0) return null;

  return (
    <points
      frustumCulled={false}
      onPointerDown={
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
  dimmed,
  edgeType,
}: {
  edges: ConstellationEdge3D[];
  dimmed: boolean;
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
        opacity={dimmed ? style.dimOpacity : style.opacity}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function ConstellationEdges({ edges, dimmed }: { edges: ConstellationEdge3D[]; dimmed: boolean }) {
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
      <EdgeLayer edges={layers.proximity} dimmed={dimmed} edgeType="proximity" />
      <EdgeLayer edges={layers.lastmile} dimmed={dimmed} edgeType="lastmile" />
    </>
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

function NetworkPulses({ edges, dimmed }: { edges: ConstellationEdge3D[]; dimmed: boolean }) {
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
      alphas.setX(i, dimmed ? fade * 0.15 : fade * 0.85);

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

function MatchedEdgeGlow({
  nodes,
  matchedNodeIds,
  matchIntensities,
}: {
  nodes: ConstellationNode3D[];
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
}) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const matchedEdges = useMemo(() => {
    if (matchedNodeIds.size === 0) return null;
    // Build edges between nearby matched nodes (within distance 4)
    const matched = nodes.filter((n) => matchedNodeIds.has(n.id));
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
        const avg = ((matchIntensities.get(a.id) ?? 0) + (matchIntensities.get(b.id) ?? 0)) / 2;
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
  }, [nodes, matchedNodeIds, matchIntensities]);

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

// --- Globe rotation group: Y-axis with Earth-like axial tilt ---

/**
 * useFrame-based idle recovery: auto-restores rotation speed after 5 seconds
 * of no user interaction. This runs inside the Three.js render loop so it
 * can never be "lost" due to swallowed pointer events from CameraControls.
 */
function IdleRotationRecovery({
  speedRef,
  lastInteractionRef,
  interactive,
}: {
  speedRef: React.RefObject<number>;
  lastInteractionRef: React.RefObject<number>;
  interactive?: boolean;
}) {
  useFrame(() => {
    if (!interactive) return;
    if (speedRef.current >= DEFAULT_ROTATION_SPEED) return;
    const elapsed = Date.now() - lastInteractionRef.current;
    if (elapsed > 5000) {
      // Smoothly restore rotation speed
      speedRef.current = Math.min(
        DEFAULT_ROTATION_SPEED,
        speedRef.current + DEFAULT_ROTATION_SPEED * 0.02,
      );
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
