'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { posthog } from '@/lib/posthog';
import { HexScore } from '@/components/HexScore';
import {
  getDimensionLabel,
  getDimensionOrder,
  getIdentityColor,
  type AlignmentScores,
} from '@/lib/drepIdentity';
import type { ConstellationNode3D } from '@/lib/constellation/types';
import { cn } from '@/lib/utils';

interface ConstellationNodeDetailProps {
  node: ConstellationNode3D | null;
  onClose: () => void;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  drep: 'DRep',
  spo: 'Stake Pool',
  cc: 'Committee Member',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  drep: 'bg-primary/20 text-primary',
  spo: 'bg-cyan-500/20 text-cyan-400',
  cc: 'bg-amber-500/20 text-amber-400',
};

function arrayToAlignmentScores(arr: number[]): AlignmentScores {
  const dims = getDimensionOrder();
  return Object.fromEntries(
    dims.map((dim, i) => [dim, arr[i] ?? 50]),
  ) as unknown as AlignmentScores;
}

function getProfileHref(node: ConstellationNode3D): string | null {
  if (node.nodeType === 'drep') return `/drep/${encodeURIComponent(node.fullId)}`;
  if (node.nodeType === 'spo') return `/pool/${encodeURIComponent(node.fullId)}`;
  return null;
}

export function ConstellationNodeDetail({ node, onClose }: ConstellationNodeDetailProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (node) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [node, onClose]);

  const profileHref = node ? getProfileHref(node) : null;
  const alignments = node ? arrayToAlignmentScores(node.alignments) : null;
  const identityColor = node ? getIdentityColor(node.dominant) : null;

  return (
    <AnimatePresence>
      {node && alignments && identityColor && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className={cn(
            'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm',
            'sm:fixed sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-auto sm:right-6 sm:translate-x-0',
            'rounded-2xl border border-white/10 bg-[#0e1028]/90 backdrop-blur-xl shadow-2xl',
            'p-5',
          )}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-4">
            <HexScore score={node.score} alignments={alignments} size="card" animate={false} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                    NODE_TYPE_COLORS[node.nodeType] || 'bg-white/10 text-white/60',
                  )}
                >
                  {NODE_TYPE_LABELS[node.nodeType] || node.nodeType}
                </span>
              </div>
              <h3 className="text-white font-semibold text-base leading-tight truncate">
                {node.name || node.fullId.slice(0, 20) + '...'}
              </h3>
              <p className="text-white/40 text-xs mt-0.5 font-mono truncate">
                {node.fullId.slice(0, 24)}...
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: `rgba(${identityColor.rgb.join(',')}, 0.12)`,
                color: identityColor.hex,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: identityColor.hex }}
              />
              {getDimensionLabel(node.dominant)}
            </div>
            <div className="text-xs text-white/40">
              Power:{' '}
              <span className="text-white/60 font-mono">{(node.power * 100).toFixed(0)}%</span>
            </div>
          </div>

          {profileHref && (
            <Link
              href={profileHref}
              onClick={() => {
                posthog.capture('constellation_profile_navigated', {
                  nodeType: node.nodeType,
                  nodeId: node.fullId,
                });
              }}
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              View full profile
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
