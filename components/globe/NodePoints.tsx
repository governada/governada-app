/**
 * NodePoints — GPU-instanced node rendering for the constellation visualization.
 *
 * Includes:
 * - ConstellationNodes: Groups nodes by type with overlay-aware coloring
 * - NodePoints: GPU-instanced point renderer with smooth focus interpolation
 *
 * Performance-critical: preserves single draw call per node type.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import type { FocusState } from '@/lib/globe/types';
import {
  DREP_COLOR,
  SPO_COLOR,
  USER_COLOR,
  PROPOSAL_COLOR,
  MATCH_COLOR,
  POINT_SCALE,
  DEFAULT_FOCUS,
} from '@/lib/globe/types';
import { getSharedFocus, getSharedFocusVersion } from '@/lib/globe/focusState';
import { NODE_VERT, NODE_FRAG, SPO_FRAG } from '@/lib/globe/shaders';
import { RaycastConfig } from '@/components/globe/GlobeAmbient';

// ---------------------------------------------------------------------------
// ConstellationNodes — Groups nodes by type with overlay-aware coloring
// ---------------------------------------------------------------------------

export function ConstellationNodes({
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

// ---------------------------------------------------------------------------
// NodePoints — GPU-instanced point renderer with smooth focus interpolation
// ---------------------------------------------------------------------------

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
        // Intermediate "maybe" nodes — partially visible, not full match glow
        const intermediateLevel =
          !isFocused && focusState.intermediateIds
            ? (focusState.intermediateIds.get(node.id) ?? -1)
            : -1;
        const isIntermediate = intermediateLevel >= 0;
        // Non-DRep nodes shrink aggressively during match nodeTypeFilter
        const isFilteredType =
          focusState.nodeTypeFilter != null &&
          (node as { nodeType?: string }).nodeType !== focusState.nodeTypeFilter;

        // COLOR
        if (isUnfocused && !isIntermediate) {
          const dimVal = 0.012 - focusState.scanProgress * 0.007;
          colors[i * 3] = Math.max(0.005, dimVal);
          colors[i * 3 + 1] = Math.max(0.005, dimVal);
          colors[i * 3 + 2] = Math.max(0.005, dimVal);
        } else if (isIntermediate) {
          // "Maybe" nodes: base color at reduced brightness
          tmpColor.set(getColor(node));
          const intEmissive = emissive * 0.3 * intermediateLevel;
          colors[i * 3] = tmpColor.r * intEmissive;
          colors[i * 3 + 1] = tmpColor.g * intEmissive;
          colors[i * 3 + 2] = tmpColor.b * intEmissive;
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
          // During match mode (DRep-only filter), cap emissive to prevent bloom wash —
          // hundreds of nodes at emissive 3.4+ merge into one undifferentiated glow.
          // Reduced emissive keeps individual nodes visually distinct.
          const matchEmissive =
            focusState.nodeTypeFilter === 'drep'
              ? emissive * (0.5 + intensity * 0.35) // match mode: max ~1.4 — distinct dots, not wash
              : emissive * (1 + intensity * 1.2);
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
          // Match mode: boost size so 800 nodes are individually visible as distinct glowing orbs
          const matchSizeBoost = focusState.nodeTypeFilter === 'drep' ? 3.5 : 1.0;
          finalSize =
            baseSize * (1 + 0.5 * intensity + focusState.scanProgress * 0.3) * matchSizeBoost;
        } else if (isIntermediate) {
          // "Maybe" nodes: partially shrunk based on brightness level
          finalSize = baseSize * (0.3 + intermediateLevel * 0.2);
        } else if (isUnfocused) {
          // Non-DRep filtered types shrink aggressively during match
          finalSize = isFilteredType
            ? baseSize * 0.15
            : baseSize * (0.5 - focusState.scanProgress * 0.1);
        } else {
          finalSize = baseSize;
        }
        sizes[i] = finalSize * POINT_SCALE;

        // DIMMED attribute (continuous for shader — 0=bright, 0.5-0.8=intermediate, 1=fully dim)
        if (isUnfocused && !isIntermediate) {
          dimmedArr[i] = 1.0;
        } else if (isIntermediate) {
          // Higher intermediateLevel = brighter → less dimmed
          dimmedArr[i] = 0.5 + (1 - intermediateLevel) * 0.3;
        } else {
          dimmedArr[i] = 0.0;
        }
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
  // Tracks when the last focus change occurred — used for activation wave delays
  const focusChangedAtRef = useRef(0);
  // Snapshot of activationDelays at the time of the last focus change
  const activeDelaysRef = useRef<Map<string, number> | null>(null);

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
    } else {
      // Focus or other visual props changed: update lerp targets so useFrame can transition.
      // This is a defensive backup to the window-globals mechanism in useFrame — ensures
      // targets are always set from the React prop path regardless of timing.
      targetBuffersRef.current = buffers;

      // When match mode activates (nodeTypeFilter='drep'), snap non-DRep nodes to invisible
      // immediately rather than waiting for the lerp to converge. Non-DRep nodes (SPO, CC,
      // proposal) should disappear the instant the match flow starts — no fade-in lag.
      if (
        focus.active &&
        focus.nodeTypeFilter === 'drep' &&
        currentDimmedRef.current &&
        currentColorsRef.current &&
        currentSizesRef.current
      ) {
        let anySnapped = false;
        for (let i = 0; i < nodes.length; i++) {
          const nodeType = (nodes[i] as { nodeType?: string }).nodeType;
          if (nodeType && nodeType !== 'drep' && currentDimmedRef.current[i] < 0.99) {
            currentDimmedRef.current[i] = 1.0;
            currentColorsRef.current[i * 3] = 0.005;
            currentColorsRef.current[i * 3 + 1] = 0.005;
            currentColorsRef.current[i * 3 + 2] = 0.005;
            currentSizesRef.current[i] = (nodes[i].scale ?? 1) * 0.15 * POINT_SCALE;
            anySnapped = true;
          }
        }
        if (anySnapped) {
          const colorAttr = geo.getAttribute('aNodeColor') as THREE.BufferAttribute;
          const dimAttr = geo.getAttribute('aDimmed') as THREE.BufferAttribute;
          const sizeAttr = geo.getAttribute('aSize') as THREE.BufferAttribute;
          if (colorAttr) colorAttr.needsUpdate = true;
          if (dimAttr) dimAttr.needsUpdate = true;
          if (sizeAttr) sizeAttr.needsUpdate = true;
        }
      }
    }
    // After first render, useFrame handles smooth transitions toward new target buffers
    // NOTE: No cleanup return here — cleanup runs in the unmount-only effect below.
    // If we returned cleanup here, it would run on every buffers change (focus changes),
    // deleting GPU attributes that useFrame then can't find — making nodes invisible.
  }, [buffers]); // eslint-disable-line react-hooks/exhaustive-deps -- focus/nodes accessed via closure from buffers dep

  // GPU attribute cleanup on unmount only — MUST be separate from the [buffers] effect.
  // Returning cleanup from [buffers] would delete attributes on every focus change.
  useEffect(() => {
    return () => {
      const g = geoRef.current;
      if (!g) return;
      for (const name of ['position', 'aNodeColor', 'aSize', 'aDimmed']) {
        if (g.hasAttribute(name)) g.deleteAttribute(name);
      }
    };
  }, []);

  // Smooth per-frame interpolation: current values → target values.
  // Focus state is read from module-level _sharedFocus/_sharedFocusVersion
  // because R3F Canvas children don't re-render when parent state changes.
  useFrame(({ clock }, delta) => {
    const geo = geoRef.current;
    if (!geo || !currentColorsRef.current || !currentSizesRef.current || !currentDimmedRef.current)
      return;

    // Detect focus state changes via window-level shared variable.
    // No React props or refs — window globals, always readable from useFrame.
    // Only updates target color/size/dimmed arrays — positions are static (nodes don't move).
    const currentVersion = getSharedFocusVersion();
    if (currentVersion !== lastFocusVersionRef.current) {
      lastFocusVersionRef.current = currentVersion;
      const newFocus = getSharedFocus();
      const newTargets = computeBuffers(newFocus);
      targetBuffersRef.current = newTargets;
      geo.setAttribute('position', new THREE.Float32BufferAttribute(newTargets.positions, 3));
      geo.computeBoundingSphere();
      // Capture activation time + delays for wave animation
      focusChangedAtRef.current = clock.getElapsedTime();
      activeDelaysRef.current = newFocus.activationDelays ?? null;
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

    // Activation wave: elapsed time since last focus change
    const delays = activeDelaysRef.current;
    const elapsed = delays ? clock.getElapsedTime() - focusChangedAtRef.current : 0;

    // Lerp colors (RGB per node) — use fast factor when dimming
    // Activation wave: nodes with a delay that hasn't elapsed yet lerp toward "unfocused" targets
    for (let i = 0; i < count; i++) {
      const isDimming = targetDimmed[i] > 0.5;
      const f = isDimming ? fastFactor : factor;

      // Wave delay: if node hasn't activated yet, override effective target to dimmed state
      const nodeDelay = delays?.get(nodes[i].id) ?? 0;
      const isDelayed = delays != null && elapsed < nodeDelay;

      for (let c = 0; c < 3; c++) {
        const idx = i * 3 + c;
        const effectiveTarget = isDelayed ? 0.005 : targetColors[idx];
        const diff = effectiveTarget - curColors[idx];
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

      const nodeDelay = delays?.get(nodes[i].id) ?? 0;
      const isDelayed = delays != null && elapsed < nodeDelay;
      const effectiveTarget = isDelayed ? nodes[i].scale * 0.15 * POINT_SCALE : targetSizes[i];

      const diff = effectiveTarget - curSizes[i];
      if (Math.abs(diff) > 0.001) {
        curSizes[i] += diff * f;
        changed = true;
      }
    }

    // Lerp dimmed — fast transition so nodes fade out visibly
    for (let i = 0; i < count; i++) {
      const nodeDelay = delays?.get(nodes[i].id) ?? 0;
      const isDelayed = delays != null && elapsed < nodeDelay;
      const effectiveTarget = isDelayed ? 1.0 : targetDimmed[i];

      const diff = effectiveTarget - curDimmed[i];
      if (Math.abs(diff) > 0.005) {
        curDimmed[i] += diff * fastFactor;
        changed = true;
      }
    }

    // Clear delays once all have elapsed (avoid per-frame Map lookups indefinitely)
    if (delays != null) {
      let maxDelay = 0;
      for (const d of delays.values()) if (d > maxDelay) maxDelay = d;
      if (elapsed > maxDelay + 0.5) activeDelaysRef.current = null;
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
