'use client';

/* eslint-disable react-hooks/purity -- Three.js useRef initializers with Vector3/random are intentional one-time setup */
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
import { computeLayout } from '@/lib/constellation/layout';
// Three-body palette: DReps=teal, SPOs=cyan, CC=gold
const DREP_COLOR = '#2dd4bf';
const SPO_COLOR = '#06b6d4';
const CC_COLOR = '#fbbf24';
const CORE_COLOR = '#fff0d4'; // warm white sun — distinct from all node colors
import type {
  ConstellationApiData,
  FindMeTarget,
  ConstellationNode3D,
  ConstellationEdge3D,
} from '@/lib/constellation/types';

export interface ConstellationRef {
  findMe: (target: FindMeTarget) => Promise<void>;
  flyToNode: (nodeId: string) => Promise<ConstellationNode3D | null>;
  pulseNode: (drepId: string) => void;
  resetCamera: () => void;
}

interface ConstellationProps {
  interactive?: boolean;
  onReady?: () => void;
  onContracted?: () => void;
  onNodeSelect?: (node: ConstellationNode3D) => void;
  className?: string;
}

// Shared state bridge between React and R3F scene
interface SceneState {
  nodes: ConstellationNode3D[];
  edges: ConstellationEdge3D[];
  nodeMap: Map<string, ConstellationNode3D>;
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  animating: boolean;
}

const INITIAL_CAMERA: [number, number, number] = [0, -18, 10];
const INITIAL_TARGET: [number, number, number] = [0, 0, -1];
const ROTATION_SPEED = 0.05; // radians/s, ~2 min per revolution

export const GovernanceConstellation = forwardRef<ConstellationRef, ConstellationProps>(
  function GovernanceConstellation(
    { interactive, onReady, onContracted, onNodeSelect, className },
    ref,
  ) {
    const cameraControlsRef = useRef<CameraControls>(null);
    const rotationAngleRef = useRef(0);
    const [ready, setReady] = useState(false);
    const [sceneState, setSceneState] = useState<SceneState>({
      nodes: [],
      edges: [],
      nodeMap: new Map(),
      highlightId: null,
      dimmed: false,
      pulseId: null,
      animating: false,
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

      const [x, y, z] = rotateAroundZ(node.position, rotationAngleRef.current);
      await controls.setLookAt(x, y, z + 5, x, y, z, true);

      onNodeSelectRef.current?.(node);
      return node;
    };

    useImperativeHandle(ref, () => ({
      findMe: async (target: FindMeTarget) => {
        const controls = cameraControlsRef.current;
        if (!controls || sceneState.nodes.length === 0) return;
        setSceneState((prev) => ({ ...prev, animating: true }));

        if (target.type === 'undelegated') {
          const edgePos: [number, number, number] = [10, -5, 2];
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
          const rotatedEdge = rotateAroundZ(edgePos, rotationAngleRef.current);
          const mid: [number, number, number] = [
            rotatedEdge[0] * 0.5,
            rotatedEdge[1] * 0.5,
            rotatedEdge[2] * 0.5 + 0.5,
          ];
          await controls.setLookAt(mid[0], mid[1], 16, mid[0], mid[1], 0, true);
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

        const [x, y, z] = rotateAroundZ(node.position, rotationAngleRef.current);
        await controls.setLookAt(x, y, z + 5, x, y, z, true);
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
        setSceneState((prev) => ({ ...prev, highlightId: null, dimmed: false, animating: false }));
      },
    }));

    const { data: apiData } = useGovernanceConstellation();

    useEffect(() => {
      if (!apiData) return;
      const gpu = estimateGPUTier();
      setQuality(gpu);
      const nodeLimit = gpu === 'low' ? 200 : gpu === 'mid' ? 500 : 800;
      const typedData = apiData as ConstellationApiData;
      const { nodes, edges, nodeMap } = computeLayout(typedData.nodes, nodeLimit);
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
            camera={{ position: INITIAL_CAMERA, fov: 65 }}
            gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: interactive ? 'auto' : 'none',
            }}
            role="img"
            aria-label="Interactive 3D visualization of Cardano governance showing DRep representatives as a glowing constellation"
          >
            <color attach="background" args={['#0a0b14']} />
            <ambientLight intensity={0.05} />

            <AmbientStarfield count={quality === 'low' ? 200 : 400} />
            <RotatingGroup enabled={!sceneState.animating} rotationRef={rotationAngleRef}>
              <GovernanceCore />
              <ConstellationNodes
                nodes={sceneState.nodes}
                highlightId={sceneState.highlightId}
                dimmed={sceneState.dimmed}
                pulseId={sceneState.pulseId}
                interactive={interactive}
                onNodeClick={interactive ? (node) => flyToNodeImpl(node.id) : undefined}
              />
              <ConstellationEdges edges={sceneState.edges} dimmed={sceneState.dimmed} />
            </RotatingGroup>
            <ShootingStars />

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
  },
);

// --- Point sprite shaders (always circular, camera-facing) ---

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
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
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
    const anchor: ConstellationNode3D[] = [];
    for (const n of nodes) {
      if (n.isAnchor) anchor.push(n);
      else if (n.nodeType === 'spo') spo.push(n);
      else if (n.nodeType === 'cc') cc.push(n);
      else drep.push(n);
    }
    return { drep, spo, cc, anchor };
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
          emissive={1.5}
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
          emissive={3.0}
        />
      )}
      <NodePoints
        nodes={groups.anchor}
        highlightId={null}
        dimmed={false}
        pulseId={null}
        interactive={false}
        getColor={getDrepColor}
        emissive={3.5}
      />
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
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
  interactive?: boolean;
  onNodeClick?: (node: ConstellationNode3D) => void;
  getColor: (node: ConstellationNode3D) => string;
  emissive: number;
}) {
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const buffers = useMemo(() => {
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

      tmpColor.set(getColor(node));
      colors[i * 3] = tmpColor.r * emissive;
      colors[i * 3 + 1] = tmpColor.g * emissive;
      colors[i * 3 + 2] = tmpColor.b * emissive;

      const isHighlighted = highlightId === node.id;
      const isPulsing = pulseId === node.id;
      sizes[i] =
        (isPulsing ? node.scale * 1.8 : isHighlighted ? node.scale * 1.5 : node.scale) *
        POINT_SCALE;
      dimmedArr[i] = dimmed && !isHighlighted && !isPulsing ? 1.0 : 0.0;
    }

    return { positions, colors, sizes, dimmedArr };
  }, [nodes, highlightId, dimmed, pulseId, getColor, emissive, tmpColor]);

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
        fragmentShader={NODE_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function ConstellationEdges({ edges, dimmed }: { edges: ConstellationEdge3D[]; dimmed: boolean }) {
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

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        color="#6888cc"
        transparent
        opacity={dimmed ? 0.03 : 0.18}
        toneMapped={false}
      />
    </lineSegments>
  );
}

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
      const r = 18 + rand() * 25;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi) * 0.3; // Flatten to ecliptic disc
    }
    return positions;
  }, [count]);

  const ref = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.008;
      ref.current.rotation.x += delta * 0.003;
    }
  });

  return (
    <points ref={ref}>
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

function GovernanceCore() {
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      const breath = 0.95 + 0.05 * Math.sin(t * 1.57);
      coreRef.current.scale.setScalar(breath);
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial
          emissive={CORE_COLOR}
          emissiveIntensity={3}
          color={CORE_COLOR}
          toneMapped={false}
        />
      </mesh>
      {/* Corona glow — soft halo around the sun */}
      <mesh>
        <sphereGeometry args={[2.0, 16, 16]} />
        <meshBasicMaterial
          color={CORE_COLOR}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color={CORE_COLOR} intensity={4} distance={12} decay={2} />
    </group>
  );
}

const METEOR_POOL = 4;
const SPAWN_MIN_S = 4;
const SPAWN_MAX_S = 10;

function ShootingStars() {
  const groupRef = useRef<THREE.Group>(null);
  const stateRef = useRef({
    meteors: Array.from({ length: METEOR_POOL }, () => ({
      active: false,
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      progress: 0,
      speed: 0,
    })),
    timer: SPAWN_MIN_S + Math.random() * (SPAWN_MAX_S - SPAWN_MIN_S),
  });

  const _pos = useRef(new THREE.Vector3());
  const _dir = useRef(new THREE.Vector3());
  const _up = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const { meteors } = stateRef.current;

    stateRef.current.timer -= delta;
    if (stateRef.current.timer <= 0) {
      stateRef.current.timer = SPAWN_MIN_S + Math.random() * (SPAWN_MAX_S - SPAWN_MIN_S);
      const slot = meteors.find((m) => !m.active);
      if (slot) {
        const angle = Math.random() * Math.PI * 2;
        const r = 13 + Math.random() * 5;
        slot.start.set(Math.cos(angle) * r, Math.sin(angle) * r, (Math.random() - 0.5) * 8);
        const endAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
        const endR = 1 + Math.random() * 6;
        slot.end.set(
          Math.cos(endAngle) * endR,
          Math.sin(endAngle) * endR,
          (Math.random() - 0.5) * 6,
        );
        slot.progress = 0;
        slot.speed = 0.5 + Math.random() * 0.4;
        slot.active = true;
      }
    }

    for (let i = 0; i < METEOR_POOL; i++) {
      const m = meteors[i];
      const mesh = group.children[i] as THREE.Mesh;
      if (!mesh) continue;

      if (!m.active) {
        mesh.visible = false;
        continue;
      }

      m.progress += delta * m.speed;
      if (m.progress >= 1) {
        m.active = false;
        mesh.visible = false;
        continue;
      }

      _pos.current.lerpVectors(m.start, m.end, m.progress);
      mesh.position.copy(_pos.current);

      _dir.current.subVectors(m.end, m.start).normalize();
      mesh.quaternion.setFromUnitVectors(_up.current, _dir.current);

      const fadeIn = Math.min(1, m.progress * 8);
      const fadeOut = 1 - m.progress * m.progress;
      const opacity = fadeIn * fadeOut * 0.8;
      mesh.scale.set(1, 0.4 + opacity * 0.8, 1);

      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      mesh.visible = true;
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: METEOR_POOL }, (_, i) => (
        <mesh key={i} visible={false}>
          <cylinderGeometry args={[0.03, 0.003, 1.5, 8]} />
          <meshBasicMaterial
            color="#e8dcc8"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function RotatingGroup({
  enabled,
  rotationRef,
  children,
}: {
  enabled: boolean;
  rotationRef: React.MutableRefObject<number>;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      if (enabled) {
        rotationRef.current += delta * ROTATION_SPEED;
      }
      groupRef.current.rotation.z = rotationRef.current;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

function rotateAroundZ(pos: [number, number, number], angle: number): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [pos[0] * c - pos[1] * s, pos[0] * s + pos[1] * c, pos[2]];
}

// --- Helpers ---

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
