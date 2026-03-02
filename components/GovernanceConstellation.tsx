'use client';

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useMemo,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Instances, Instance, CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { computeLayout } from '@/lib/constellation/layout';
import { getIdentityColor } from '@/lib/drepIdentity';
import type { ConstellationApiData, FindMeTarget, ConstellationNode3D, ConstellationEdge3D } from '@/lib/constellation/types';

export interface ConstellationRef {
  findMe: (target: FindMeTarget) => Promise<void>;
  pulseNode: (drepId: string) => void;
  resetCamera: () => void;
}

interface ConstellationProps {
  onReady?: () => void;
  onContracted?: () => void;
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

const INITIAL_CAMERA: [number, number, number] = [0, 0, 22];
const INITIAL_TARGET: [number, number, number] = [0, 0, 0];

export const GovernanceConstellation = forwardRef<ConstellationRef, ConstellationProps>(
  function GovernanceConstellation({ onReady, onContracted, className }, ref) {
    const cameraControlsRef = useRef<CameraControls>(null);
    const [ready, setReady] = useState(false);
    const [sceneState, setSceneState] = useState<SceneState>({
      nodes: [], edges: [], nodeMap: new Map(),
      highlightId: null, dimmed: false, pulseId: null, animating: false,
    });
    const [quality, setQuality] = useState<'low' | 'mid' | 'high'>('high');

    useImperativeHandle(ref, () => ({
      findMe: async (target: FindMeTarget) => {
        const controls = cameraControlsRef.current;
        if (!controls || sceneState.nodes.length === 0) return;
        setSceneState(prev => ({ ...prev, animating: true }));

        if (target.type === 'undelegated') {
          const edgePos: [number, number, number] = [10, -5, 2];
          setSceneState(prev => ({
            ...prev,
            highlightId: '__user__',
            dimmed: true,
            nodes: [...prev.nodes, {
              id: '__user__', name: 'You', power: 0, score: 50,
              dominant: 'transparency', alignments: [50, 50, 50, 50, 50, 50],
              position: edgePos, scale: 0.08,
            }],
          }));
          const mid: [number, number, number] = [5, -2.5, 1];
          await controls.setLookAt(mid[0], mid[1], 16, mid[0], mid[1], 0, true);
          await sleep(2000);
          setSceneState(prev => ({ ...prev, animating: false }));
          onContracted?.();
          return;
        }

        const drepId = target.drepId;
        if (!drepId) { setSceneState(prev => ({ ...prev, animating: false })); onContracted?.(); return; }

        const node = sceneState.nodeMap.get(drepId);
        if (!node) { setSceneState(prev => ({ ...prev, animating: false })); onContracted?.(); return; }

        setSceneState(prev => ({ ...prev, highlightId: drepId, dimmed: true }));

        const [x, y, z] = node.position;
        await controls.setLookAt(x, y, z + 5, x, y, z, true);
        await sleep(2000);

        setSceneState(prev => ({ ...prev, highlightId: null, dimmed: false }));
        await controls.setLookAt(...INITIAL_CAMERA, ...INITIAL_TARGET, true);
        await sleep(800);
        setSceneState(prev => ({ ...prev, animating: false }));
        onContracted?.();
      },

      pulseNode: (drepId: string) => {
        setSceneState(prev => ({ ...prev, pulseId: drepId }));
        setTimeout(() => setSceneState(prev => ({ ...prev, pulseId: null })), 1200);
      },

      resetCamera: () => {
        cameraControlsRef.current?.setLookAt(...INITIAL_CAMERA, ...INITIAL_TARGET, true);
        setSceneState(prev => ({ ...prev, highlightId: null, dimmed: false }));
      },
    }));

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const gpu = estimateGPUTier();
          setQuality(gpu);

          const nodeLimit = gpu === 'low' ? 200 : gpu === 'mid' ? 500 : 800;

          const res = await fetch('/api/governance/constellation');
          if (!res.ok || cancelled) return;
          const data: ConstellationApiData = await res.json();

          const { nodes, edges, nodeMap } = computeLayout(data.nodes, nodeLimit);
          if (cancelled) return;

          setSceneState(prev => ({ ...prev, nodes, edges, nodeMap }));
          setReady(true);
          onReady?.();
        } catch (err) {
          console.error('Constellation init failed:', err);
        }
      })();
      return () => { cancelled = true; };
    }, [onReady]);

    const dpr = quality === 'low' ? 1 : quality === 'mid' ? 1.5 : Math.min(window.devicePixelRatio, 2);

    return (
      <div
        className={`relative z-0 w-full ${className || ''}`}
        style={{ minHeight: '100vh', background: '#0a0b14' }}
      >
        {ready && (
          <Canvas
            dpr={dpr}
            camera={{ position: INITIAL_CAMERA, fov: 60 }}
            gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            role="img"
            aria-label="Interactive 3D visualization of Cardano governance showing DRep representatives as a glowing constellation"
          >
            <color attach="background" args={['#0a0b14']} />
            <ambientLight intensity={0.05} />

            <AmbientStarfield count={quality === 'low' ? 200 : 400} />
            <GovernanceCore />
            <ConstellationNodes
              nodes={sceneState.nodes}
              highlightId={sceneState.highlightId}
              dimmed={sceneState.dimmed}
              pulseId={sceneState.pulseId}
            />
            <ConstellationEdges edges={sceneState.edges} dimmed={sceneState.dimmed} />
            <ShootingStars />

            {quality !== 'low' && (
              <EffectComposer>
                <Bloom
                  mipmapBlur
                  intensity={1.4}
                  luminanceThreshold={0.15}
                  luminanceSmoothing={0.9}
                  radius={0.85}
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
            <AutoRotate controlsRef={cameraControlsRef} enabled={!sceneState.animating} />
          </Canvas>
        )}
      </div>
    );
  }
);

// --- Scene sub-components ---

function ConstellationNodes({
  nodes, highlightId, dimmed, pulseId,
}: {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  pulseId: string | null;
}) {
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFrameReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (nodes.length === 0 || !frameReady) return null;

  const regularNodes = nodes.filter(n => !n.isAnchor);
  const anchorNodes = nodes.filter(n => n.isAnchor);

  return (
    <>
      <Instances limit={regularNodes.length + 10} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial
          emissive="white"
          emissiveIntensity={2}
          toneMapped={false}
          transparent
        />
        {regularNodes.map(node => {
          const color = getIdentityColor(node.dominant);
          const isHighlighted = highlightId === node.id;
          const isPulsing = pulseId === node.id;
          const s = isPulsing ? node.scale * 1.8 : isHighlighted ? node.scale * 1.5 : node.scale;

          return (
            <Instance
              key={node.id}
              position={node.position}
              scale={s}
              color={color.hex}
            />
          );
        })}
      </Instances>

      <Instances limit={anchorNodes.length + 2} frustumCulled={false}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          emissive="white"
          emissiveIntensity={3.5}
          toneMapped={false}
          transparent
        />
        {anchorNodes.map(node => {
          const color = getIdentityColor(node.dominant);
          return (
            <Instance
              key={node.id}
              position={node.position}
              scale={node.scale}
              color={color.hex}
            />
          );
        })}
      </Instances>
    </>
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

function AmbientStarfield({ count }: { count: number }) {
  const points = useMemo(() => {
    const rand = seededRandom(42);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 18 + rand() * 25;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
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
        <bufferAttribute
          attach="attributes-position"
          args={[points, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
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
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshStandardMaterial
          emissive="#ffd280"
          emissiveIntensity={3.5}
          color="#ffd280"
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#ffd280" intensity={8} distance={18} decay={2} />
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
      const slot = meteors.find(m => !m.active);
      if (slot) {
        const angle = Math.random() * Math.PI * 2;
        const r = 13 + Math.random() * 5;
        slot.start.set(Math.cos(angle) * r, Math.sin(angle) * r, (Math.random() - 0.5) * 8);
        const endAngle = angle + Math.PI + (Math.random() - 0.5) * 0.8;
        const endR = 1 + Math.random() * 6;
        slot.end.set(Math.cos(endAngle) * endR, Math.sin(endAngle) * endR, (Math.random() - 0.5) * 6);
        slot.progress = 0;
        slot.speed = 0.5 + Math.random() * 0.4;
        slot.active = true;
      }
    }

    for (let i = 0; i < METEOR_POOL; i++) {
      const m = meteors[i];
      const mesh = group.children[i] as THREE.Mesh;
      if (!mesh) continue;

      if (!m.active) { mesh.visible = false; continue; }

      m.progress += delta * m.speed;
      if (m.progress >= 1) { m.active = false; mesh.visible = false; continue; }

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
          <cylinderGeometry args={[0.03, 0.003, 1.5, 4]} />
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

function AutoRotate({ controlsRef, enabled }: {
  controlsRef: { current: { azimuthAngle: number } | null };
  enabled: boolean;
}) {
  useFrame((_, delta) => {
    if (controlsRef.current && enabled) {
      controlsRef.current.azimuthAngle += delta * 0.05;
    }
  });
  return null;
}

// --- Helpers ---

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
