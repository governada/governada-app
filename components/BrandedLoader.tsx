'use client';

import { useState, useEffect } from 'react';

/**
 * Full-screen branded loading screen shown once on first visit.
 * Animated G constellation: nodes appear and lines draw to form
 * the Governada "G" logo — matching the actual brand mark.
 * Self-dismisses after ~2.3s. SessionStorage prevents repeat shows.
 */

// ── Node definitions: positions that trace the G logo shape ──
// Outer arc (counter-clockwise from top), crossbar, and interior constellation
const NODES = [
  // Outer arc
  { id: 0, cx: 100, cy: 18, r: 3.5, delay: 0 }, // top center
  { id: 1, cx: 58, cy: 28, r: 3.5, delay: 0.08 }, // upper left
  { id: 2, cx: 28, cy: 62, r: 3.5, delay: 0.16 }, // left upper
  { id: 3, cx: 18, cy: 105, r: 3.5, delay: 0.24 }, // left middle
  { id: 4, cx: 30, cy: 148, r: 3.5, delay: 0.32 }, // lower left
  { id: 5, cx: 65, cy: 175, r: 3.5, delay: 0.4 }, // bottom left
  { id: 6, cx: 110, cy: 182, r: 3.5, delay: 0.48 }, // bottom center
  { id: 7, cx: 152, cy: 165, r: 3.5, delay: 0.56 }, // bottom right
  { id: 8, cx: 175, cy: 132, r: 3.5, delay: 0.64 }, // lower right
  { id: 9, cx: 180, cy: 98, r: 3.5, delay: 0.72 }, // right (crossbar junction)
  // Crossbar
  { id: 10, cx: 148, cy: 102, r: 3.0, delay: 0.8 }, // crossbar middle
  { id: 11, cx: 115, cy: 105, r: 3.0, delay: 0.88 }, // crossbar tip
  // Interior constellation
  { id: 12, cx: 72, cy: 75, r: 2.5, delay: 0.96 }, // upper interior
  { id: 13, cx: 78, cy: 132, r: 2.5, delay: 1.04 }, // lower interior
] as const;

// ── Connection definitions ──
// Arc connections form the G outline; interior connections add constellation depth
type Edge = {
  from: number;
  to: number;
  type: 'arc' | 'interior';
};

const EDGES: Edge[] = [
  // Arc outline (the G shape)
  { from: 0, to: 1, type: 'arc' },
  { from: 1, to: 2, type: 'arc' },
  { from: 2, to: 3, type: 'arc' },
  { from: 3, to: 4, type: 'arc' },
  { from: 4, to: 5, type: 'arc' },
  { from: 5, to: 6, type: 'arc' },
  { from: 6, to: 7, type: 'arc' },
  { from: 7, to: 8, type: 'arc' },
  { from: 8, to: 9, type: 'arc' },
  { from: 9, to: 10, type: 'arc' },
  { from: 10, to: 11, type: 'arc' },
  // Interior constellation cross-connections
  { from: 1, to: 12, type: 'interior' },
  { from: 12, to: 3, type: 'interior' },
  { from: 12, to: 11, type: 'interior' },
  { from: 12, to: 13, type: 'interior' },
  { from: 3, to: 13, type: 'interior' },
  { from: 13, to: 5, type: 'interior' },
  { from: 13, to: 7, type: 'interior' },
  { from: 13, to: 10, type: 'interior' },
  { from: 7, to: 10, type: 'interior' },
];

/** Calculate line length for stroke-dasharray animation */
function lineLength(fromId: number, toId: number): number {
  const a = NODES[fromId];
  const b = NODES[toId];
  return Math.sqrt((b.cx - a.cx) ** 2 + (b.cy - a.cy) ** 2);
}

/** Get the draw delay for an edge — starts after both endpoint nodes have appeared */
function edgeDelay(edge: Edge): number {
  const fromNode = NODES[edge.from];
  const toNode = NODES[edge.to];
  // Line starts drawing 0.1s after the later node appears
  return Math.max(fromNode.delay, toNode.delay) + 0.1;
}

export function BrandedLoader() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const seen = sessionStorage.getItem('governada-intro-seen');
    if (seen) return;

    setVisible(true);
    sessionStorage.setItem('governada-intro-seen', '1');

    const fadeTimer = setTimeout(() => setFading(true), 1800);
    const hideTimer = setTimeout(() => setVisible(false), 2300);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`force-dark fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0a0b14] transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-hidden
    >
      {/* G Constellation SVG — nodes and lines forming the Governada logo */}
      <svg viewBox="0 0 200 200" width={160} height={160} className="mb-6">
        <defs>
          <filter id="loader-glow">
            <feGaussianBlur stdDeviation="3" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          {/* Teal gradient matching the G logo */}
          <linearGradient id="g-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ACFFE4" />
            <stop offset="100%" stopColor="#38bebe" />
          </linearGradient>
        </defs>

        {/* Connection lines — draw between nodes to form the G */}
        {EDGES.map((edge, i) => {
          const from = NODES[edge.from];
          const to = NODES[edge.to];
          const len = lineLength(edge.from, edge.to);
          const delay = edgeDelay(edge);
          const isArc = edge.type === 'arc';

          return (
            <line
              key={`edge-${i}`}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={isArc ? 'rgba(56, 190, 190, 0.5)' : 'rgba(56, 190, 190, 0.15)'}
              strokeWidth={isArc ? 1 : 0.5}
              strokeDasharray={len}
              strokeDashoffset={len}
              strokeLinecap="round"
            >
              {/* Line-draw animation: dashoffset from full length to 0 */}
              <animate
                attributeName="stroke-dashoffset"
                from={len}
                to="0"
                dur="0.4s"
                begin={`${delay}s`}
                fill="freeze"
                calcMode="spline"
                keySplines="0.16 1 0.3 1"
              />
            </line>
          );
        })}

        {/* Nodes — appear staggered, tracing the G shape */}
        {NODES.map((node) => (
          <circle
            key={`node-${node.id}`}
            cx={node.cx}
            cy={node.cy}
            r="0"
            fill="url(#g-gradient)"
            filter="url(#loader-glow)"
          >
            {/* Scale up: 0 → overshoot → settle */}
            <animate
              attributeName="r"
              values={`0;${node.r + 1};${node.r}`}
              dur="0.5s"
              begin={`${node.delay}s`}
              fill="freeze"
              calcMode="spline"
              keySplines="0.22 1 0.36 1;0.22 1 0.36 1"
            />
            {/* Fade in */}
            <animate
              attributeName="opacity"
              values="0;1;0.85"
              dur="0.5s"
              begin={`${node.delay}s`}
              fill="freeze"
            />
          </circle>
        ))}

        {/* Subtle bloom pulse on the completed G */}
        <circle
          cx="100"
          cy="100"
          r="80"
          fill="none"
          stroke="rgba(56, 190, 190, 0.08)"
          strokeWidth="40"
          opacity="0"
        >
          <animate
            attributeName="opacity"
            values="0;0.15;0"
            dur="0.8s"
            begin="1.3s"
            fill="freeze"
          />
          <animate attributeName="r" values="60;90" dur="0.8s" begin="1.3s" fill="freeze" />
        </circle>
      </svg>

      {/* Brand text */}
      <div
        className="text-center animate-fade-in-up"
        style={{ animationDelay: '1.3s', animationFillMode: 'both' }}
      >
        <p className="text-2xl font-bold text-primary tracking-tight font-sans">Governada</p>
        <p className="text-sm text-muted-foreground mt-1 tracking-wide">
          Governance Intelligence for Cardano
        </p>
      </div>
    </div>
  );
}
