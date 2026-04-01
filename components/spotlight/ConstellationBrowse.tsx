'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';
import { ConstellationLegend } from './ConstellationLegend';
import type { ConstellationRef } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[60vh] w-full items-center justify-center bg-background text-sm text-muted-foreground">
        Loading constellation...
      </div>
    ),
  },
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConstellationBrowseProps {
  trackedIds: Set<string>;
  /** Called when user clicks a node to see its spotlight card */
  onNodeSelect: (nodeId: string, nodeType: string) => void;
  /** Called when user exits constellation view */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Interactive constellation globe as a browse surface.
 * Tracked entities pulse, others are dimmed.
 * Click a node to open its spotlight card.
 */
export function ConstellationBrowse({
  trackedIds,
  onNodeSelect,
  onClose,
}: ConstellationBrowseProps) {
  const reducedMotion = useReducedMotion();
  const constellationRef = useRef<ConstellationRef>(null);
  const [selectedNode, setSelectedNode] = useState<ConstellationNode3D | null>(null);
  const [ready, setReady] = useState(false);

  // Pulse tracked nodes once constellation is ready
  useEffect(() => {
    if (!ready || !constellationRef.current) return;

    // Pulse each tracked node
    for (const id of trackedIds) {
      constellationRef.current.pulseNode(id);
    }
  }, [ready, trackedIds]);

  const handleNodeSelect = useCallback(
    (node: ConstellationNode3D) => {
      setSelectedNode(node);
      onNodeSelect(node.fullId ?? node.id, node.nodeType);
    },
    [onNodeSelect],
  );

  const handleReady = useCallback(() => {
    setReady(true);
  }, []);

  return (
    <motion.div
      className="relative flex flex-col"
      variants={reducedMotion ? undefined : fadeInUp}
      initial={reducedMotion ? undefined : 'hidden'}
      animate="visible"
    >
      {/* Back button */}
      <div className="flex items-center justify-between px-2 py-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Spotlight
        </button>

        <ConstellationLegend />
      </div>

      {/* Globe container */}
      <div className="relative h-[60vh] min-h-[400px] w-full overflow-hidden rounded-xl border border-border/20">
        <ConstellationScene
          ref={constellationRef}
          interactive={true}
          engineEnabled={false}
          onNodeSelect={(node: ConstellationNode3D) => handleNodeSelect(node)}
          onReady={handleReady}
        />

        {/* Selected node detail overlay */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-border/40 bg-card/90 p-4 backdrop-blur-md sm:left-auto sm:w-80"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold">{selectedNode.name ?? selectedNode.id}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedNode.nodeType} · Score: {Math.round(selectedNode.score)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  onNodeSelect(selectedNode.fullId ?? selectedNode.id, selectedNode.nodeType);
                }}
                className="mt-3 w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              >
                View in Spotlight
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tracked count overlay */}
        {trackedIds.size > 0 && (
          <div className="absolute left-4 top-4 rounded-lg border border-amber-500/20 bg-card/80 px-3 py-1.5 text-xs backdrop-blur-sm">
            <span className="tabular-nums font-medium text-amber-400">{trackedIds.size}</span>{' '}
            <span className="text-muted-foreground">tracked — pulsing on globe</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
