'use client';

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  User,
  BarChart3,
  Sparkles,
  Eye,
  Vote,
  FileText,
  Lightbulb,
  Share2,
  Building,
  Activity,
  Scale,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConstellationNode3D, GovernanceNodeType } from '@/lib/constellation/types';

interface RadialMenuProps {
  node: ConstellationNode3D;
  screenPos: { x: number; y: number };
  onAction: (action: string, node: ConstellationNode3D) => void;
  onClose: () => void;
}

interface ActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
}

const ACTION_SETS: Record<GovernanceNodeType, ActionItem[] | null> = {
  drep: [
    { id: 'delegate', label: 'Delegate', icon: ArrowRight, primary: true },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'compare', label: 'Compare', icon: BarChart3 },
    { id: 'ask_seneca', label: 'Ask Seneca', icon: Sparkles },
    { id: 'watch', label: 'Watch', icon: Eye },
  ],
  proposal: [
    { id: 'vote', label: 'Vote', icon: Vote, primary: true },
    { id: 'review', label: 'Review', icon: FileText },
    { id: 'explain', label: 'Explain', icon: Lightbulb },
    { id: 'share', label: 'Share', icon: Share2 },
  ],
  spo: [
    { id: 'profile', label: 'Profile', icon: Building, primary: true },
    { id: 'votes', label: 'Votes', icon: Vote },
    { id: 'monitor', label: 'Monitor', icon: Activity },
    { id: 'share', label: 'Share', icon: Share2 },
  ],
  cc: [
    { id: 'record', label: 'Record', icon: FileText, primary: true },
    { id: 'stance', label: 'Stance', icon: Scale },
    { id: 'profile', label: 'Profile', icon: User },
  ],
  user: null,
};

const RADIUS = 90;
const EDGE_MARGIN = 120;

function getAdjustedCenter(
  screenPos: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let x = screenPos.x;
  let y = screenPos.y;

  if (x < EDGE_MARGIN) x = EDGE_MARGIN;
  if (x > viewportWidth - EDGE_MARGIN) x = viewportWidth - EDGE_MARGIN;
  if (y < EDGE_MARGIN) y = EDGE_MARGIN;
  if (y > viewportHeight - EDGE_MARGIN) y = viewportHeight - EDGE_MARGIN;

  return { x, y };
}

export default function RadialMenu({ node, screenPos, onAction, onClose }: RadialMenuProps) {
  const actions = ACTION_SETS[node.nodeType];

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const center = useMemo(() => {
    if (typeof window === 'undefined') return screenPos;
    return getAdjustedCenter(screenPos, window.innerWidth, window.innerHeight);
  }, [screenPos]);

  if (!actions) return null;

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none">
      {/* Click backdrop */}
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

      <AnimatePresence>
        {/* Center dot */}
        <motion.div
          key="center-dot"
          className="absolute pointer-events-none rounded-full"
          style={{
            width: 12,
            height: 12,
            left: center.x - 6,
            top: center.y - 6,
            background: 'oklch(0.72 0.12 192)',
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
        />

        {/* Action buttons */}
        {actions.map((action, i) => {
          const angle = (i / actions.length) * Math.PI * 2 - Math.PI / 2;
          const x = center.x + Math.cos(angle) * RADIUS;
          const y = center.y + Math.sin(angle) * RADIUS;
          const Icon = action.icon;

          return (
            <motion.button
              key={action.id}
              className={`group absolute pointer-events-auto flex flex-col items-center gap-1`}
              style={{
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 28,
                delay: i * 0.04,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAction(action.id, node);
              }}
            >
              <div
                className={`flex items-center justify-center size-11 rounded-full bg-[oklch(0.15_0.01_260/0.7)] backdrop-blur-xl border transition-colors ${
                  action.primary
                    ? 'border-[oklch(0.72_0.12_192/0.3)] hover:border-[oklch(0.72_0.12_192/0.6)]'
                    : 'border-white/[0.1] hover:border-white/[0.2]'
                }`}
              >
                <Icon className="size-4 text-foreground/70 group-hover:text-foreground transition-colors" />
              </div>
              <span className="text-[10px] text-foreground/60 whitespace-nowrap">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
