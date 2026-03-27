'use client';

/**
 * NetworkEdges — SVG overlay showing relationship lines between globe nodes.
 *
 * Only renders when the active overlay is 'network'.
 * Draws delegation bonds (teal), voting alignment (amber), and CC-DRep patterns (violet).
 *
 * Uses an HTML/SVG overlay rather than R3F lines for simplicity and to avoid
 * coupling with the WebGL render pipeline. Positions are projected from 3D to screen space.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useCockpitStore } from '@/stores/cockpitStore';

interface NetworkEdge {
  from: string;
  to: string;
  type: 'delegation' | 'alignment' | 'cc-drep';
  weight: number;
}

const EDGE_COLORS: Record<string, string> = {
  delegation: '#2dd4bf', // teal
  alignment: '#fbbf24', // amber
  'cc-drep': '#a78bfa', // violet
};

// EDGE_DASH available for future SVG line rendering when 3D→2D projection is wired

export function NetworkEdges() {
  const activeOverlay = useCockpitStore((s) => s.activeOverlay);
  const isVisible = activeOverlay === 'network';

  const { data } = useQuery<{ edges: NetworkEdge[] }>({
    queryKey: ['cockpit-network-edges'],
    queryFn: async () => {
      const res = await fetch('/api/cockpit/network-edges');
      if (!res.ok) return { edges: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: isVisible,
  });

  const edges = data?.edges ?? [];

  // Since we can't easily project 3D positions to screen without the camera reference,
  // we show a simplified network legend + edge count indicator
  // The full projection would require the Three.js camera, which lives inside the Canvas
  const edgeCounts = useMemo(() => {
    const counts = { delegation: 0, alignment: 0, 'cc-drep': 0 };
    for (const edge of edges) {
      counts[edge.type] = (counts[edge.type] ?? 0) + 1;
    }
    return counts;
  }, [edges]);

  return (
    <AnimatePresence>
      {isVisible && edges.length > 0 && (
        <motion.div
          key="network-edges-legend"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-auto fixed left-4 bottom-20 z-20 rounded-lg border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-md"
        >
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
            Network Edges
          </p>
          <div className="flex flex-col gap-1">
            {edgeCounts.delegation > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-px w-4" style={{ backgroundColor: EDGE_COLORS.delegation }} />
                <span className="text-[10px] text-muted-foreground">
                  {edgeCounts.delegation} delegation bonds
                </span>
              </div>
            )}
            {edgeCounts.alignment > 0 && (
              <div className="flex items-center gap-2">
                <svg width="16" height="2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke={EDGE_COLORS.alignment}
                    strokeWidth="1"
                    strokeDasharray="4 2"
                  />
                </svg>
                <span className="text-[10px] text-muted-foreground">
                  {edgeCounts.alignment} voting alignment pairs
                </span>
              </div>
            )}
            {edgeCounts['cc-drep'] > 0 && (
              <div className="flex items-center gap-2">
                <svg width="16" height="2">
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke={EDGE_COLORS['cc-drep']}
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                </svg>
                <span className="text-[10px] text-muted-foreground">
                  {edgeCounts['cc-drep']} CC-DRep alignments
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
