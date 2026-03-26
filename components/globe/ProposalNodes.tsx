'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const PROPOSAL_COLOR = '#e8dfd0';
const PROPOSAL_HIGHLIGHT_COLOR = '#ffffff';

interface ProposalNodesProps {
  nodes: ConstellationNode3D[];
  highlightId: string | null;
  dimmed: boolean;
  matchedNodeIds: Set<string>;
  matchIntensities: Map<string, number>;
}

// Custom shader for proposal octahedra with urgency-driven emissive glow
const proposalVertexShader = /* glsl */ `
  attribute vec3 instanceColorAttr;
  attribute float instanceUrgency;

  varying vec3 vColor;
  varying float vUrgency;
  varying vec3 vNormal;

  void main() {
    vColor = instanceColorAttr;
    vUrgency = instanceUrgency;
    vNormal = normalize(normalMatrix * normal);

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const proposalFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vUrgency;
  varying vec3 vNormal;

  void main() {
    // Simple rim lighting
    float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    rim = pow(rim, 2.0);

    // Base color with urgency-driven emissive boost
    vec3 emissive = vColor * (0.3 + vUrgency * 0.7);
    vec3 finalColor = vColor * 0.5 + emissive + vec3(rim * 0.15);

    float alpha = 0.85 + vUrgency * 0.15;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const _baseColor = new THREE.Color(PROPOSAL_COLOR);
const _highlightColor = new THREE.Color(PROPOSAL_HIGHLIGHT_COLOR);
const _matchColor = new THREE.Color('#f59e0b');
const _tempColor = new THREE.Color();
const _tempMatrix = new THREE.Matrix4();
const _tempQuat = new THREE.Quaternion();
const _tempScale = new THREE.Vector3();
const _tempPos = new THREE.Vector3();
const _rotAxis = new THREE.Vector3(0, 1, 0);

export function ProposalNodes({
  nodes,
  highlightId,
  dimmed,
  matchedNodeIds,
  matchIntensities,
}: ProposalNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rotationsRef = useRef<Float32Array>(new Float32Array(0));

  // Per-instance attributes
  const { colorArray, urgencyArray } = useMemo(() => {
    const count = nodes.length;
    const colors = new Float32Array(count * 3);
    const urgencies = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      const isHighlighted = highlightId === node.id;
      const isMatched = matchedNodeIds.has(node.id);
      const matchIntensity = matchIntensities.get(node.id) ?? 0;

      // Determine color
      if (isHighlighted) {
        _tempColor.copy(_highlightColor);
      } else if (isMatched) {
        _tempColor.copy(_baseColor).lerp(_matchColor, matchIntensity);
      } else if (dimmed) {
        _tempColor.copy(_baseColor).multiplyScalar(0.3);
      } else {
        _tempColor.copy(_baseColor);
      }

      colors[i * 3] = _tempColor.r;
      colors[i * 3 + 1] = _tempColor.g;
      colors[i * 3 + 2] = _tempColor.b;

      // Urgency is encoded in the score field (0-100 mapped back to 0-1)
      urgencies[i] = Math.min(1, (node.score ?? 0) / 100);
    }

    return { colorArray: colors, urgencyArray: urgencies };
  }, [nodes, highlightId, dimmed, matchedNodeIds, matchIntensities]);

  // Geometry and material (stable references)
  const geometry = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: proposalVertexShader,
        fragmentShader: proposalFragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  // Initialize instance matrices and per-instance rotation speeds
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || nodes.length === 0) return;

    // Initialize random rotation offsets for each instance
    const rotations = new Float32Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      rotations[i] = Math.random() * Math.PI * 2;
    }
    rotationsRef.current = rotations;

    // Set initial transforms
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      _tempPos.set(node.position[0], node.position[1], node.position[2]);
      _tempQuat.setFromAxisAngle(_rotAxis, rotations[i]);
      _tempScale.setScalar(node.scale);
      _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
      mesh.setMatrixAt(i, _tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Set instance attributes
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3);
    const urgencyAttr = new THREE.InstancedBufferAttribute(urgencyArray, 1);
    mesh.geometry.setAttribute('instanceColorAttr', colorAttr);
    mesh.geometry.setAttribute('instanceUrgency', urgencyAttr);
  }, [nodes, colorArray, urgencyArray]);

  // Gentle y-axis spin animation
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || nodes.length === 0) return;

    const rotations = rotationsRef.current;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      // Each octahedron spins slowly; urgent ones spin slightly faster
      const urgency = Math.min(1, (node.score ?? 0) / 100);
      const speed = 0.15 + urgency * 0.3; // radians per second
      rotations[i] += delta * speed;

      _tempPos.set(node.position[0], node.position[1], node.position[2]);
      _tempQuat.setFromAxisAngle(_rotAxis, rotations[i]);
      _tempScale.setScalar(node.scale);
      _tempMatrix.compose(_tempPos, _tempQuat, _tempScale);
      mesh.setMatrixAt(i, _tempMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (nodes.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, nodes.length]} frustumCulled={false} />
  );
}
