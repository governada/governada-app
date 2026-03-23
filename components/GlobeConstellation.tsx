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
const GLOBE_LINE_COLOR = '#334488';
const MATCH_COLOR = '#f59e0b'; // Warm amber — distinct from teal, purple, gold

interface GlobeConstellationProps {
  interactive?: boolean;
  onReady?: () => void;
  onContracted?: () => void;
  onNodeSelect?: (node: ConstellationNode3D) => void;
  className?: string;
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
  { interactive, onReady, onContracted, onNodeSelect, className },
  ref,
) {
  const cameraControlsRef = useRef<CameraControls>(null);
  const rotationAngleRef = useRef(0);
  const rotationSpeedRef = useRef(DEFAULT_ROTATION_SPEED);
  const [ready, setReady] = useState(false);
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

  const onNodeSelectRef = useRef(onNodeSelect);
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  const flyToNodeImpl = async (nodeId: string): Promise<ConstellationNode3D | null> => {
    const controls = cameraControlsRef.current;
    if (!controls || sceneState.nodes.length === 0) return null;

    const node = sceneState.nodes.find((n) => n.id === nodeId || n.fullId === nodeId);
    if (!node || node.isAnchor) return null;

    setSceneState((prev) => ({ ...prev, animating: true, highlightId: node.id, dimmed: true }));

    const [x, y, z] = rotateAroundY(node.position, rotationAngleRef.current);
    await controls.setLookAt(x * 1.5, y * 1.5, z * 1.5 + 3, x, y, z, true);

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
      await controls.setLookAt(...INITIAL_CAMERA, ...INITIAL_TARGET, true);
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
      cameraControlsRef.current?.setLookAt(...INITIAL_CAMERA, ...INITIAL_TARGET, true);
      setSceneState((prev) => ({
        ...prev,
        highlightId: null,
        dimmed: false,
        animating: false,
      }));
    },

    highlightMatches: (userAlignment: number[], threshold: number) => {
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

      // Progressive camera zoom — closer as threshold narrows ("Xavier's room" convergence)
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

          // Zoom level scales with threshold — tighter threshold = closer camera
          // threshold 160 → camDist 13 (barely zoomed), threshold 35 → camDist 6 (very close)
          const zoomFactor = Math.max(0, Math.min(1, (160 - threshold) / 125));

          // Slow rotation as we zoom in — creates "locking on" feeling
          // Full speed at zoomFactor 0, near-stopped at zoomFactor 1
          rotationSpeedRef.current = DEFAULT_ROTATION_SPEED * (1 - zoomFactor * 0.85);
          const camDist = 13 - zoomFactor * 7; // 13 → 6
          const lookWeight = 0.3 + zoomFactor * 0.4; // 0.3 → 0.7 (look more directly at cluster)

          const dir = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
          const nx = cx / dir;
          const ny = cy / dir;
          const nz = cz / dir;

          // Smooth camera convergence (false = animate, not instant jump)
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
      cameraControlsRef.current?.setLookAt(...INITIAL_CAMERA, ...INITIAL_TARGET, true);
    },
  }));

  const { data: apiData } = useGovernanceConstellation();

  useEffect(() => {
    if (!apiData) return;
    const gpu = estimateGPUTier();
    setQuality(gpu);
    const nodeLimit = gpu === 'low' ? 200 : gpu === 'mid' ? 500 : 800;
    const typedData = apiData as ConstellationApiData;
    const { nodes, edges, nodeMap } = computeGlobeLayout(typedData.nodes, nodeLimit);
    setSceneState((prev) => ({ ...prev, nodes, edges, nodeMap }));
    setReady(true);
    onReady?.();
  }, [apiData, onReady]);

  const dpr =
    quality === 'low' ? 1 : quality === 'mid' ? 1.5 : Math.min(window.devicePixelRatio, 2);

  return (
    <div className={`relative z-0 w-full ${className || ''}`} style={{ background: '#0a0b14' }}>
      {ready && (
        <Canvas
          dpr={dpr}
          camera={{ position: INITIAL_CAMERA, fov: 60 }}
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
          <TiltedGlobeGroup
            enabled={!sceneState.animating}
            rotationRef={rotationAngleRef}
            speedRef={rotationSpeedRef}
          >
            <InnerGlow />
            <GlobeAtmosphere
              radius={8.1}
              color="#4488cc"
              warmColor="#cc8844"
              intensity={0.8}
              matchProgress={sceneState.scanProgress}
            />
            <GlobeAtmosphere
              radius={8.5}
              color="#2244aa"
              warmColor="#aa6622"
              intensity={0.3}
              matchProgress={sceneState.scanProgress}
            />
            <GlobeWireframe radius={8} opacity={0.04} />
            <ConstellationNodes
              nodes={sceneState.nodes}
              highlightId={sceneState.highlightId}
              dimmed={sceneState.dimmed}
              pulseId={sceneState.pulseId}
              interactive={interactive}
              onNodeClick={interactive ? (node) => flyToNodeImpl(node.id) : undefined}
              matchedNodeIds={sceneState.matchedNodeIds}
              matchIntensities={sceneState.matchIntensities}
            />
            <ConstellationEdges edges={sceneState.edges} dimmed={sceneState.dimmed} />
            {quality !== 'low' && (
              <MatchedEdgeGlow
                nodes={sceneState.nodes}
                matchedNodeIds={sceneState.matchedNodeIds}
                matchIntensities={sceneState.matchIntensities}
              />
            )}
            {quality !== 'low' && sceneState.scanProgress < 0.5 && (
              <ScanningRing
                active={sceneState.matchedNodeIds.size > 0}
                progress={sceneState.scanProgress}
              />
            )}
            {quality !== 'low' && (
              <NetworkPulses edges={sceneState.edges} dimmed={sceneState.dimmed} />
            )}
          </TiltedGlobeGroup>

          {quality !== 'low' && (
            <FlyToParticles target={sceneState.flyToTarget} active={sceneState.flyToActive} />
          )}

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
            mouseButtons={{ left: 0, middle: 0, right: 0, wheel: 0 }}
            touches={{ one: 0, two: 0, three: 0 }}
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

// --- Subtle wireframe grid (very faint structural lines) ---

function GlobeWireframe({ radius, opacity }: { radius: number; opacity: number }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    const segments = 64;

    // Only equator + 2 latitude lines for subtle structure
    for (const latDeg of [-45, 0, 45]) {
      const lat = (latDeg * Math.PI) / 180;
      const r = radius * Math.cos(lat);
      const z = radius * Math.sin(lat);
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        points.push(r * Math.cos(a1), r * Math.sin(a1), z);
        points.push(r * Math.cos(a2), r * Math.sin(a2), z);
      }
    }

    // Only 6 meridians (60° apart) instead of 12
    for (let lonDeg = 0; lonDeg < 360; lonDeg += 60) {
      const lon = (lonDeg * Math.PI) / 180;
      for (let i = 0; i < segments; i++) {
        const lat1 = (i / segments) * Math.PI - Math.PI / 2;
        const lat2 = ((i + 1) / segments) * Math.PI - Math.PI / 2;
        points.push(
          radius * Math.cos(lat1) * Math.cos(lon),
          radius * Math.cos(lat1) * Math.sin(lon),
          radius * Math.sin(lat1),
        );
        points.push(
          radius * Math.cos(lat2) * Math.cos(lon),
          radius * Math.cos(lat2) * Math.sin(lon),
          radius * Math.sin(lat2),
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, [radius]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color={GLOBE_LINE_COLOR}
        transparent
        opacity={opacity}
        toneMapped={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}

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
  matchedNodeIds,
  matchIntensities,
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
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
    for (const n of nodes) {
      if (n.isAnchor) continue;
      if (n.nodeType === 'spo') spo.push(n);
      else if (n.nodeType === 'cc') cc.push(n);
      else drep.push(n);
    }
    return { drep, spo, cc };
  }, [nodes]);

  const getDrepColor = useCallback(() => DREP_COLOR, []);
  const getSpoColor = useCallback(() => SPO_COLOR, []);
  const getCcColor = useCallback(() => CC_COLOR, []);

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
        getColor={getDrepColor}
        emissive={2.0}
        matchedNodeIds={matchedNodeIds}
        matchIntensities={matchIntensities}
      />
      {groups.spo.length > 0 && (
        <NodePoints
          nodes={groups.spo}
          highlightId={highlightId}
          dimmed={dimmed}
          pulseId={pulseId}
          interactive={interactive}
          onNodeClick={onNodeClick}
          getColor={getSpoColor}
          emissive={2.0}
          fragmentShader={SPO_FRAG}
          matchedNodeIds={matchedNodeIds}
          matchIntensities={matchIntensities}
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
          getColor={getCcColor}
          emissive={3.5}
          fragmentShader={CC_FRAG}
          matchedNodeIds={matchedNodeIds}
          matchIntensities={matchIntensities}
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
  getColor,
  emissive,
  fragmentShader,
  matchedNodeIds,
  matchIntensities,
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  getColor: (node: ConstellationNode3D) => string;
  emissive: number;
  fragmentShader?: string;
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
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
        colors[i * 3] = tmpColor.r * emissive;
        colors[i * 3 + 1] = tmpColor.g * emissive;
        colors[i * 3 + 2] = tmpColor.b * emissive;
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

function InnerGlow() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial
          color="#334466"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#4466aa" intensity={1.5} distance={10} decay={2} />
    </group>
  );
}

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

// --- Scanning sweep ring (radar-like ring during matching) ---

function ScanningRing({ active, progress }: { active: boolean; progress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const targetOpacity = useRef(0);

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;
    // Continuous rotation on Z-axis tilted differently from globe
    meshRef.current.rotation.z += delta * 0.036; // ~3x globe speed
    meshRef.current.rotation.x += delta * 0.008; // slight tumble

    // Scale ring down aggressively — disappears before camera gets close enough to clip
    // progress 0 → scale 1 (radius 8.5), progress 0.5+ → rapidly shrinks
    const s = Math.max(0, 1 - progress * 0.7);
    meshRef.current.scale.set(s, s, s);

    // Fade out early — visible only in the first half of convergence (rounds 1-2)
    // progress 0 → full opacity, progress 0.5 → gone
    const fadeOut = progress > 0.3 ? Math.max(0, 1 - (progress - 0.3) / 0.2) : 1;
    const desired = active ? (0.15 + progress * 0.1) * fadeOut : 0;
    targetOpacity.current += (desired - targetOpacity.current) * Math.min(1, delta * 3);
    matRef.current.opacity = targetOpacity.current;
  });

  // Lerp color from teal toward amber as progress increases
  const color = useMemo(() => {
    const teal = new THREE.Color('#2dd4bf');
    const amber = new THREE.Color('#f59e0b');
    return teal.clone().lerp(amber, progress * 0.6);
  }, [progress]);

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[8.5, 0.02 + progress * 0.02, 8, 64]} />
      <meshBasicMaterial
        ref={matRef}
        color={color}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
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

function TiltedGlobeGroup({
  enabled,
  rotationRef,
  speedRef,
  children,
}: {
  enabled: boolean;
  rotationRef: React.MutableRefObject<number>;
  speedRef: React.MutableRefObject<number>;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      if (enabled) {
        rotationRef.current += delta * speedRef.current;
      }
      // Apply axial tilt on X, then spin on Y (local)
      groupRef.current.rotation.x = AXIAL_TILT;
      groupRef.current.rotation.y = rotationRef.current;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

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
