'use client';

/**
 * Constellation2D — 2D canvas fallback for low-end devices.
 *
 * Renders the same governance constellation data as a flat circular layout
 * using Canvas 2D API. No WebGL dependency. Implements the same ConstellationRef
 * imperative API so GlobeLayout can drive it identically to the 3D scene.
 *
 * Node positions are projected from 3D → 2D by dropping the Z axis and
 * mapping the XY radial layout to canvas coordinates.
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
  type Ref,
} from 'react';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import type { ConstellationNode3D, ConstellationApiData } from '@/lib/constellation/types';
import { useGovernanceConstellation } from '@/hooks/queries';
import { computeLayout } from '@/lib/constellation/layout';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_LIMIT_2D = 200; // Fewer nodes for performance on low-end
const BG_COLOR = '#0a0b14';
const NODE_COLORS: Record<string, string> = {
  drep: '#6ee7b7', // emerald
  spo: '#93c5fd', // blue
  cc: '#fcd34d', // amber
  proposal: '#c4b5fd', // violet
  anchor: 'rgba(255,255,255,0.15)',
};
const HIGHLIGHT_COLOR = '#facc15';
const MATCH_COLORS: Record<string, string> = {
  Yes: '#4ade80',
  No: '#f87171',
  Abstain: '#94a3b8',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Constellation2DProps {
  interactive?: boolean;
  className?: string;
  onReady?: () => void;
  onNodeSelect?: (node: ConstellationNode3D) => void;
  breathing?: boolean;
}

interface CanvasState {
  nodes: ConstellationNode3D[];
  nodeMap: Map<string, ConstellationNode3D>;
  focusId: string | null;
  highlightId: string | null;
  matchIds: Set<string>;
  voteSplitMap: Map<string, 'Yes' | 'No' | 'Abstain'> | null;
  dimmed: boolean;
  cameraX: number;
  cameraY: number;
  zoom: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Constellation2D = forwardRef(function Constellation2D(
  { interactive, className, onReady, onNodeSelect, breathing }: Constellation2DProps,
  ref: Ref<ConstellationRef>,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CanvasState>({
    nodes: [],
    nodeMap: new Map(),
    focusId: null,
    highlightId: null,
    matchIds: new Set(),
    voteSplitMap: null,
    dimmed: false,
    cameraX: 0,
    cameraY: 0,
    zoom: 1,
  });
  const animFrameRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const breathRef = useRef(0);

  // Load constellation data
  const { data: apiData } = useGovernanceConstellation();

  useEffect(() => {
    if (!apiData) return;
    const typedData = apiData as ConstellationApiData;
    const { nodes, nodeMap } = computeLayout(typedData.nodes, NODE_LIMIT_2D);
    stateRef.current.nodes = nodes;
    stateRef.current.nodeMap = nodeMap;
    setReady(true);
    onReady?.();
  }, [apiData, onReady]);

  // ---------------------------------------------------------------------------
  // 3D → 2D projection (orthographic: drop Z, map XY to canvas)
  // ---------------------------------------------------------------------------

  const project = useCallback(
    (pos: [number, number, number], width: number, height: number): [number, number] => {
      const s = stateRef.current;
      const scale = Math.min(width, height) / 36; // MAX_RADIUS ≈ 15, so 30 diameter + padding
      const cx = width / 2 + s.cameraX * scale;
      const cy = height / 2 + s.cameraY * scale;
      return [cx + pos[0] * scale * s.zoom, cy + pos[1] * scale * s.zoom];
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Resize canvas backing store if needed
    const canvasW = Math.round(width * dpr);
    const canvasH = Math.round(height * dpr);
    if (canvas.width !== canvasW || canvas.height !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    const s = stateRef.current;
    if (s.nodes.length === 0) return;

    // Breathing animation
    if (breathing) {
      breathRef.current += 0.01;
    }
    const breathScale = breathing ? 1 + Math.sin(breathRef.current) * 0.005 : 1;

    // Draw nodes
    for (const node of s.nodes) {
      const [x, y] = project(node.position, width, height);
      const baseRadius = node.scale * Math.min(width, height) * 0.03 * s.zoom * breathScale;
      const radius = Math.max(baseRadius, 2); // min 2px for tappability

      // Determine color
      let color = NODE_COLORS[node.nodeType] || NODE_COLORS.drep;
      let alpha = 1;

      if (node.isAnchor) {
        color = NODE_COLORS.anchor;
        alpha = 0.3;
      }

      // Vote split coloring
      if (s.voteSplitMap) {
        const vote = s.voteSplitMap.get(`drep_${node.fullId}`) || s.voteSplitMap.get(node.id);
        if (vote) {
          color = MATCH_COLORS[vote];
        } else {
          alpha = 0.15;
        }
      }

      // Dimming for non-highlighted nodes
      if (s.dimmed && s.highlightId !== node.id && !s.matchIds.has(node.id)) {
        alpha = 0.12;
      }

      // Match highlighting
      if (s.matchIds.has(node.id)) {
        alpha = 1;
      }

      // Focus glow
      const isFocused = s.focusId === node.id;
      const isHighlighted = s.highlightId === node.id;

      if (isFocused || isHighlighted) {
        // Glow effect
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${HIGHLIGHT_COLOR}40`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.fillStyle = `${HIGHLIGHT_COLOR}80`;
        ctx.fill();
      }

      // Main node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    animFrameRef.current = requestAnimationFrame(render);
  }, [project, breathing]);

  // Start render loop
  useEffect(() => {
    if (!ready) return;
    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [ready, render]);

  // ---------------------------------------------------------------------------
  // Touch / click interaction
  // ---------------------------------------------------------------------------

  const findNodeAt = useCallback(
    (clientX: number, clientY: number): ConstellationNode3D | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const width = rect.width;
      const height = rect.height;

      let closest: ConstellationNode3D | null = null;
      let closestDist = 24; // 24px hit radius for touch

      for (const node of stateRef.current.nodes) {
        if (node.isAnchor) continue;
        const [x, y] = project(node.position, width, height);
        const dist = Math.hypot(mx - x, my - y);
        if (dist < closestDist) {
          closest = node;
          closestDist = dist;
        }
      }

      return closest;
    },
    [project],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!interactive) return;
      const clientX = 'touches' in e ? e.changedTouches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.changedTouches[0].clientY : e.clientY;
      const node = findNodeAt(clientX, clientY);
      if (node) {
        onNodeSelect?.(node);
      }
    },
    [interactive, findNodeAt, onNodeSelect],
  );

  // ---------------------------------------------------------------------------
  // Pinch-to-zoom (touch)
  // ---------------------------------------------------------------------------

  const lastPinchRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        if (lastPinchRef.current !== null) {
          const delta = dist - lastPinchRef.current;
          stateRef.current.zoom = Math.max(0.5, Math.min(3, stateRef.current.zoom + delta * 0.005));
        }
        lastPinchRef.current = dist;
      }
    }

    function onTouchEnd() {
      lastPinchRef.current = null;
    }

    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [interactive]);

  // ---------------------------------------------------------------------------
  // Imperative ref (ConstellationRef API)
  // ---------------------------------------------------------------------------

  useImperativeHandle(ref, () => ({
    findMe: async () => {
      /* no-op in 2D */
    },
    flyToNode: async (nodeId: string) => {
      const node = stateRef.current.nodeMap.get(nodeId);
      if (!node) return null;
      stateRef.current.focusId = nodeId;
      // Pan camera to center on node
      stateRef.current.cameraX = -node.position[0];
      stateRef.current.cameraY = -node.position[1];
      stateRef.current.zoom = 1.8;
      return node;
    },
    pulseNode: (nodeId: string) => {
      stateRef.current.highlightId = nodeId;
      setTimeout(() => {
        if (stateRef.current.highlightId === nodeId) {
          stateRef.current.highlightId = null;
        }
      }, 2000);
    },
    resetCamera: () => {
      stateRef.current.cameraX = 0;
      stateRef.current.cameraY = 0;
      stateRef.current.zoom = 1;
      stateRef.current.focusId = null;
      stateRef.current.highlightId = null;
      stateRef.current.dimmed = false;
      stateRef.current.matchIds.clear();
      stateRef.current.voteSplitMap = null;
    },
    highlightMatches: (alignment: number[], threshold: number, options) => {
      const matches = new Set<string>();
      for (const node of stateRef.current.nodes) {
        if (node.isAnchor || node.nodeType !== 'drep') continue;
        // Simple cosine-like similarity
        const dotProduct = node.alignments.reduce((sum, a, i) => sum + a * (alignment[i] || 0), 0);
        const magA = Math.sqrt(node.alignments.reduce((s, v) => s + v * v, 0));
        const magB = Math.sqrt(alignment.reduce((s, v) => s + v * v, 0));
        const similarity = magA && magB ? dotProduct / (magA * magB) : 0;
        if (similarity >= threshold / 100) {
          matches.add(node.id);
        }
      }
      stateRef.current.matchIds = matches;
      stateRef.current.dimmed = true;
      if (options?.zoomToCluster && matches.size > 0) {
        stateRef.current.zoom = 1.5;
      }
    },
    flyToMatch: async (drepId: string) => {
      const nodeId = `drep_${drepId}`;
      const node = stateRef.current.nodeMap.get(nodeId);
      if (!node) return;
      stateRef.current.focusId = nodeId;
      stateRef.current.cameraX = -node.position[0];
      stateRef.current.cameraY = -node.position[1];
      stateRef.current.zoom = 2;
    },
    clearMatches: () => {
      stateRef.current.matchIds.clear();
      stateRef.current.dimmed = false;
    },
    setVoteSplit: (map) => {
      stateRef.current.voteSplitMap = map;
    },
    setTemporalState: (_progress, voteMap) => {
      stateRef.current.voteSplitMap = voteMap;
    },
    clearTemporal: () => {
      stateRef.current.voteSplitMap = null;
    },
    highlightNode: (nodeId: string | null) => {
      stateRef.current.highlightId = nodeId;
      stateRef.current.dimmed = nodeId != null;
    },

    // 2D fallback: rotation/zoom/flash degrade gracefully
    setRotationSpeed: () => {}, // no rotation in 2D
    zoomToDistance: () => {}, // no camera dolly in 2D
    flashNode: (_nodeId: string) => {
      // No flash effect in 2D — pulse is handled differently
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full touch-none ${className || ''}`}
      style={{ background: BG_COLOR }}
      onClick={handleClick}
      onTouchEnd={handleClick}
    />
  );
});
