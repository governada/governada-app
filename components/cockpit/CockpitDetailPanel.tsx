'use client';

/**
 * CockpitDetailPanel — Right-side detail panel for selected globe nodes.
 *
 * Slides in from the right (1/3 width on desktop) with glassmorphic styling.
 * Shows peek content for the selected entity + "Open in Studio →" for proposals.
 * Close via Esc, backdrop click, or close button → globe resetCamera().
 */

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PeekContent } from '@/components/governada/peeks/PeekContent';
import { useCockpitStore } from '@/stores/cockpitStore';
import type { PeekEntity } from '@/hooks/usePeekDrawer';
import type { ConstellationNode3D } from '@/lib/constellation/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeToEntity(node: ConstellationNode3D): PeekEntity | null {
  switch (node.nodeType) {
    case 'drep':
      return { type: 'drep', id: node.fullId ?? node.id };
    case 'spo':
      return { type: 'pool', id: node.fullId ?? node.id };
    case 'cc':
      return { type: 'cc', id: node.fullId ?? node.id };
    case 'proposal': {
      // Proposal IDs are formatted as "proposal-{txHash}-{index}"
      const parts = node.id.replace(/^proposal-/, '').split('-');
      const index = parts.pop();
      const txHash = parts.join('-');
      if (!txHash) return null;
      return { type: 'proposal', id: txHash, secondaryId: index ?? '0' };
    }
    default:
      return null;
  }
}

function getStudioHref(node: ConstellationNode3D): string | null {
  if (node.nodeType === 'proposal') {
    const parts = node.id.replace(/^proposal-/, '').split('-');
    const index = parts.pop();
    const txHash = parts.join('-');
    if (txHash) return `/workspace/review?proposal=${txHash}-${index ?? '0'}`;
  }
  if (node.nodeType === 'drep') {
    return `/drep/${node.fullId ?? node.id}`;
  }
  if (node.nodeType === 'spo') {
    return `/pool/${node.fullId ?? node.id}`;
  }
  if (node.nodeType === 'cc') {
    return `/governance/committee/${node.fullId ?? node.id}`;
  }
  return null;
}

function getActionLabel(node: ConstellationNode3D): string {
  switch (node.nodeType) {
    case 'proposal':
      return 'Open in Studio';
    case 'drep':
      return 'View Profile';
    case 'spo':
      return 'View Pool';
    case 'cc':
      return 'View Member';
    default:
      return 'View Details';
  }
}

/** QG-4: Derive a meaningful display name for the panel header */
function getDisplayName(node: ConstellationNode3D): string {
  if (node.name) return node.name;
  switch (node.nodeType) {
    case 'proposal':
      return `Proposal #${node.id.replace(/^proposal-/, '').slice(-8)}`;
    case 'drep':
      return `DRep ${(node.fullId ?? node.id).slice(0, 8)}…`;
    case 'spo':
      return `Pool ${(node.fullId ?? node.id).slice(0, 8)}…`;
    case 'cc':
      return `CC Member ${(node.fullId ?? node.id).slice(0, 8)}…`;
    default:
      return node.id.slice(0, 16);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CockpitDetailPanelProps {
  node: ConstellationNode3D | null;
  onClose: () => void;
}

export function CockpitDetailPanel({ node, onClose }: CockpitDetailPanelProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const setHoveredNode = useCockpitStore((s) => s.setHoveredNode);

  const entity = node ? nodeToEntity(node) : null;
  const studioHref = node ? getStudioHref(node) : null;
  const actionLabel = node ? getActionLabel(node) : '';

  // Set hovered node so Seneca strip reacts to the selected entity
  useEffect(() => {
    if (node) {
      setHoveredNode(node.id);
    }
    return () => {
      // Don't clear on unmount — let CockpitHomePage handle that via onClose
    };
  }, [node, setHoveredNode]);

  // Esc to close
  useEffect(() => {
    if (!node) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [node, onClose]);

  // Focus trap — focus panel on open
  useEffect(() => {
    if (node && panelRef.current) {
      panelRef.current.focus();
    }
  }, [node]);

  const handleNavigate = useCallback(() => {
    if (studioHref) {
      router.push(studioHref);
    }
  }, [router, studioHref]);

  return (
    <AnimatePresence>
      {node && entity && (
        <>
          {/* Backdrop — click to close */}
          <motion.div
            key="cockpit-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-30 bg-black/20"
            onClick={onClose}
            aria-hidden
          />

          {/* Panel */}
          <motion.div
            key="cockpit-detail-panel"
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label={`Details for ${getDisplayName(node)}`}
            initial={prefersReducedMotion ? { opacity: 0 } : { x: '100%', opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { x: '100%', opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 40,
              duration: prefersReducedMotion ? 0 : undefined,
            }}
            className={
              'fixed right-0 top-0 z-40 flex h-full w-full flex-col ' +
              'border-l border-white/10 bg-black/70 backdrop-blur-xl ' +
              'sm:w-[420px] lg:w-[33vw] lg:max-w-[520px] ' +
              'outline-none overflow-hidden'
            }
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-4 w-4 shrink-0 text-compass-teal" />
                <h2 className="truncate text-sm font-semibold text-foreground">
                  {getDisplayName(node)}
                </h2>
                <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {node.nodeType}
                </span>
              </div>
              <button
                onClick={onClose}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Peek content — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <PeekContent entity={entity} />
            </div>

            {/* Footer — action button */}
            {studioHref && (
              <div className="border-t border-white/10 px-4 py-3">
                <button
                  onClick={handleNavigate}
                  className={
                    'flex w-full items-center justify-center gap-2 rounded-lg ' +
                    'bg-compass-teal/15 px-4 py-2.5 text-sm font-medium text-compass-teal ' +
                    'transition-colors hover:bg-compass-teal/25 ' +
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-compass-teal/50'
                  }
                >
                  {actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
