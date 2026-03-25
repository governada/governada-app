'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface GlobeTooltipProps {
  node: ConstellationNode3D | null;
  screenPos: { x: number; y: number } | null;
}

const OFFSET = 16;

/**
 * Cursor-following tooltip for globe node hover.
 * Flips position near viewport edges to stay visible.
 */
export function GlobeTooltip({ node, screenPos }: GlobeTooltipProps) {
  const prefersReducedMotion = useReducedMotion();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!screenPos || !node) {
      setPosition(null);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: right and below cursor
    let x = screenPos.x + OFFSET;
    let y = screenPos.y + OFFSET;

    // Flip horizontal near right edge
    if (screenPos.x > vw - 300) {
      x = screenPos.x - OFFSET - 260;
    }

    // Flip vertical near bottom edge
    if (screenPos.y > vh - 200) {
      y = screenPos.y - OFFSET - 120;
    }

    setPosition({ x, y });
  }, [screenPos, node]);

  const typeLabel = node?.nodeType === 'drep' ? 'DRep' : node?.nodeType === 'spo' ? 'SPO' : 'CC';
  const typeColor =
    node?.nodeType === 'drep'
      ? 'text-teal-400'
      : node?.nodeType === 'spo'
        ? 'text-purple-400'
        : 'text-amber-400';

  const displayName = node?.name
    ? node.name.length > 20
      ? node.name.slice(0, 20) + '...'
      : node.name
    : node
      ? `${node.id.slice(0, 12)}...`
      : '';

  const formattedPower =
    node && node.power > 0
      ? node.power >= 1_000_000
        ? `${(node.power / 1_000_000).toFixed(1)}M`
        : node.power >= 1_000
          ? `${(node.power / 1_000).toFixed(0)}K`
          : String(node.power)
      : null;

  return (
    <AnimatePresence>
      {node && position && (
        <motion.div
          ref={tooltipRef}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'pointer-events-none fixed z-[100]',
            'rounded-xl border border-white/10 bg-black/85 backdrop-blur-md',
            'px-4 py-3 shadow-2xl max-w-[280px]',
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {/* Name */}
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>

          {/* Type + Score + Power */}
          <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
            <span className={typeColor}>{typeLabel}</span>
            <span>
              Score <strong className="text-white/90">{node.score}</strong>
            </span>
            {formattedPower && (
              <span>
                <strong className="text-white/90">{formattedPower}</strong> &#8371;
              </span>
            )}
          </div>

          {/* Hint */}
          <p className="text-[10px] text-white/40 mt-1.5">Click to explore &rarr;</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
