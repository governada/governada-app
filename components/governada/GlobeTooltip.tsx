'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCockpitStore } from '@/stores/cockpitStore';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface GlobeTooltipProps {
  node: ConstellationNode3D | null;
  screenPos: { x: number; y: number } | null;
  /** Show "Find your match" CTA for anonymous users */
  showMatchCta?: boolean;
}

const OFFSET = 16;

function formatAda(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

// ---------------------------------------------------------------------------
// Action button style
// ---------------------------------------------------------------------------
const ACTION_BTN =
  'text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-compass-teal/70 hover:text-compass-teal transition-colors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dispatchResearch(node: ConstellationNode3D) {
  window.dispatchEvent(
    new CustomEvent('senecaGlobeCommand', {
      detail: { type: 'pulse', nodeId: node.id },
    }),
  );
  // Also open Seneca thread with a contextual query
  const label =
    node.nodeType === 'drep'
      ? 'DRep'
      : node.nodeType === 'spo'
        ? 'pool'
        : node.nodeType === 'cc'
          ? 'committee member'
          : 'proposal';
  const name = node.name ?? node.id.slice(0, 12);
  window.dispatchEvent(
    new CustomEvent('senecaOpen', {
      detail: { query: `Tell me about ${label} ${name}` },
    }),
  );
}

function getProfileHref(node: ConstellationNode3D): string {
  switch (node.nodeType) {
    case 'drep':
      return `/drep/${node.id}`;
    case 'spo':
      return `/pool/${node.id}`;
    case 'cc':
      return `/committee/${node.id}`;
    case 'proposal':
      return `/governance/proposals`;
    default:
      return '/';
  }
}

// ---------------------------------------------------------------------------
/**
 * Cursor-following tooltip for globe node hover.
 * Shows entity-specific details for DReps, SPOs, and CC members.
 * Optionally shows a "Find your match" CTA for anonymous users.
 */
export function GlobeTooltip({ node, screenPos, showMatchCta }: GlobeTooltipProps) {
  const prefersReducedMotion = useReducedMotion();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const visitedNodeIds = useCockpitStore((s) => s.visitedNodeIds);
  const setHoveredNode = useCockpitStore((s) => s.setHoveredNode);
  const markNodeVisited = useCockpitStore((s) => s.markNodeVisited);

  // -------------------------------------------------------------------------
  // Hovered node tracking
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (node) {
      setHoveredNode(node.id);
    } else {
      setHoveredNode(null);
    }
    return () => setHoveredNode(null);
  }, [node, setHoveredNode]);

  // -------------------------------------------------------------------------
  // Position calculation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!screenPos || !node) {
      setPosition(null);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let x = screenPos.x + OFFSET;
    let y = screenPos.y + OFFSET;

    if (screenPos.x > vw - 300) {
      x = screenPos.x - OFFSET - 260;
    }
    if (screenPos.y > vh - 200) {
      y = screenPos.y - OFFSET - 140;
    }

    setPosition({ x, y });
  }, [screenPos, node]);

  const displayName = node?.name
    ? node.name.length > 24
      ? node.name.slice(0, 24) + '...'
      : node.name
    : node
      ? `${node.id.slice(0, 12)}...`
      : '';

  const handleMatchClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('startSenecaMatch'));
  }, []);

  const isVisited = node ? visitedNodeIds.includes(node.id) : false;

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------
  const handleResearch = useCallback(() => {
    if (!node) return;
    markNodeVisited(node.id);
    dispatchResearch(node);
  }, [node, markNodeVisited]);

  const handleCompare = useCallback(() => {
    if (!node) return;
    markNodeVisited(node.id);
    window.location.href = `/compare?drep=${node.id}`;
  }, [node, markNodeVisited]);

  const handleDelegate = useCallback(() => {
    if (!node) return;
    markNodeVisited(node.id);
    window.location.href = '/delegation';
  }, [node, markNodeVisited]);

  const handleReview = useCallback(() => {
    if (!node) return;
    markNodeVisited(node.id);
    window.location.href = '/governance/proposals';
  }, [node, markNodeVisited]);

  const handleViewProfile = useCallback(() => {
    if (!node) return;
    markNodeVisited(node.id);
    window.location.href = getProfileHref(node);
  }, [node, markNodeVisited]);

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
            'fixed z-[100] pointer-events-auto',
            'rounded-xl border border-white/10 bg-black/85 backdrop-blur-md',
            'px-4 py-3 shadow-2xl max-w-[280px]',
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {/* Name + visited chip */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            {isVisited && (
              <span className="text-[9px] text-muted-foreground/40 bg-white/5 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                Visited
              </span>
            )}
          </div>

          {/* Entity-specific details */}
          {node.nodeType === 'drep' && <DRepTooltipContent node={node} />}
          {node.nodeType === 'spo' && <SPOTooltipContent node={node} />}
          {node.nodeType === 'cc' && <CCTooltipContent node={node} />}
          {node.nodeType === 'proposal' && <ProposalTooltipContent node={node} />}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {node.nodeType === 'drep' && (
              <>
                <button onClick={handleResearch} className={ACTION_BTN}>
                  Research
                </button>
                <button onClick={handleCompare} className={ACTION_BTN}>
                  Compare
                </button>
                <button onClick={handleDelegate} className={ACTION_BTN}>
                  Delegate
                </button>
              </>
            )}
            {node.nodeType === 'proposal' && (
              <>
                <button onClick={handleReview} className={ACTION_BTN}>
                  Review
                </button>
                <button onClick={handleResearch} className={ACTION_BTN}>
                  Research
                </button>
              </>
            )}
            {node.nodeType === 'spo' && (
              <>
                <button onClick={handleResearch} className={ACTION_BTN}>
                  Research
                </button>
                <button onClick={handleViewProfile} className={ACTION_BTN}>
                  View Profile
                </button>
              </>
            )}
            {node.nodeType === 'cc' && (
              <>
                <button onClick={handleResearch} className={ACTION_BTN}>
                  Research
                </button>
                <button onClick={handleViewProfile} className={ACTION_BTN}>
                  View Profile
                </button>
              </>
            )}
          </div>

          {/* Match CTA for anonymous users */}
          {showMatchCta && node.nodeType === 'drep' && (
            <button
              onClick={handleMatchClick}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/15 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 transition-colors"
            >
              <Compass className="h-3 w-3" />
              Find your match
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DRepTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
        <span className="text-teal-400">DRep</span>
        <span>
          Score <strong className="text-white/90">{node.score}</strong>
        </span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
        {node.adaAmount != null && node.adaAmount > 0 && (
          <span>
            <strong className="text-white/80">{formatAda(node.adaAmount)}</strong> &#8371; delegated
          </span>
        )}
        {node.delegatorCount != null && node.delegatorCount > 0 && (
          <span>{node.delegatorCount.toLocaleString()} delegators</span>
        )}
      </div>
    </>
  );
}

function SPOTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
        <span className="text-purple-400">Pool</span>
        <span>
          Score <strong className="text-white/90">{node.score}</strong>
        </span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
        {node.voteCount != null && node.voteCount > 0 && (
          <span>
            <strong className="text-white/80">{node.voteCount}</strong> governance votes
          </span>
        )}
      </div>
    </>
  );
}

function CCTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
        <span className="text-amber-400">Committee</span>
        {node.fidelityGrade && (
          <span>
            Grade <strong className="text-white/90">{node.fidelityGrade}</strong>
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-white/50">Constitutional Committee Member</div>
    </>
  );
}

function ProposalTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
      <span className="text-blue-400">Proposal</span>
      {node.score > 0 && (
        <span>
          Score <strong className="text-white/90">{node.score}</strong>
        </span>
      )}
    </div>
  );
}
