'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface CrosshairReticleProps {
  node: ConstellationNode3D | null;
  screenPos: { x: number; y: number } | null;
  isLocked?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  drep: 'DRep',
  spo: 'SPO',
  cc: 'CC Member',
  proposal: 'Proposal',
  user: 'You',
};

export default function CrosshairReticle({ node, screenPos, isLocked }: CrosshairReticleProps) {
  const flipCard = useMemo(() => {
    if (!screenPos || typeof window === 'undefined') return false;
    return screenPos.x > window.innerWidth - 300;
  }, [screenPos]);

  if (!node || !screenPos) {
    if (!isLocked) return null;
    return null;
  }

  const cardOffsetX = flipCard ? -80 : 80;
  const cardOffsetY = -40;
  const cardX = screenPos.x + cardOffsetX;
  const cardY = screenPos.y + cardOffsetY;

  const lineEndX = flipCard
    ? cardX + 200 // right edge of card when flipped
    : cardX;

  return (
    <AnimatePresence>
      <motion.div
        key={node.id}
        className="fixed inset-0 z-[40] pointer-events-none"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        {/* SVG reticle + connecting line */}
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          {/* Outer ring — dashed, rotating */}
          <circle
            cx={screenPos.x}
            cy={screenPos.y}
            r={24}
            fill="none"
            stroke="oklch(0.72 0.12 192)"
            strokeWidth={1}
            strokeDasharray="4 4"
            className="animate-[reticle-spin_8s_linear_infinite]"
            style={{ transformOrigin: `${screenPos.x}px ${screenPos.y}px` }}
          />

          {/* Inner ring — solid */}
          <circle
            cx={screenPos.x}
            cy={screenPos.y}
            r={12}
            fill="none"
            stroke="oklch(0.72 0.12 192 / 0.5)"
            strokeWidth={1}
          />

          {/* Connecting line to card */}
          <line
            x1={screenPos.x}
            y1={screenPos.y}
            x2={lineEndX}
            y2={cardY + 20}
            stroke="oklch(0.72 0.12 192 / 0.3)"
            strokeWidth={1}
          />
        </svg>

        {/* Info card */}
        <div
          className="absolute max-w-[200px] rounded-lg bg-[oklch(0.15_0.01_260/0.7)] backdrop-blur-xl border border-white/[0.1] px-3 py-2"
          style={{
            left: flipCard ? cardX : cardX,
            top: cardY,
          }}
        >
          <p className="text-sm font-medium text-foreground truncate">{node.name ?? node.id}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="inline-block size-1.5 rounded-full bg-[oklch(0.72_0.12_192)]" />
            {TYPE_LABELS[node.nodeType] ?? node.nodeType}
            {node.score > 0 && (
              <span className="ml-auto tabular-nums">{Math.round(node.score * 100)}</span>
            )}
          </p>
          <p className="text-[10px] text-foreground/50 mt-1">Click for actions</p>
        </div>
      </motion.div>

      {/* Keyframe injected via style tag (Tailwind v4 @keyframes) */}
      <style>{`
        @keyframes reticle-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AnimatePresence>
  );
}
