'use client';

/**
 * PanelOverlay — Glassmorphic entity detail panel that floats over the globe.
 *
 * Desktop: slides in from the right (400px wide).
 * Mobile: slides up as a bottom sheet (max 70vh).
 * Dismissible via close button, Escape key, or clicking the backdrop (mobile).
 */

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DRepGlobePanel } from './DRepGlobePanel';
import { ProposalGlobePanel } from './ProposalGlobePanel';
import { PoolGlobePanel } from './PoolGlobePanel';
import { CCMemberGlobePanel } from './CCMemberGlobePanel';
import { deriveEntityFromPath } from './panelUtils';

interface PanelOverlayProps {
  /** Callback when panel requests globe camera restore */
  onClose?: () => void;
  /** When true, collapse to a narrow strip (e.g., when Seneca is open) */
  collapsed?: boolean;
  /** Called when user clicks the collapsed strip to expand */
  onExpand?: () => void;
}

export function PanelOverlay({ onClose, collapsed, onExpand }: PanelOverlayProps) {
  const pathname = usePathname();
  const router = useRouter();
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const entity = deriveEntityFromPath(pathname);

  // Close → navigate to /g (globe home)
  const handleClose = useCallback(() => {
    onClose?.();
    router.push('/g');
  }, [router, onClose]);

  // Escape key
  useEffect(() => {
    if (!entity) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [entity, handleClose]);

  // Focus panel when it opens
  useEffect(() => {
    if (!entity) return;
    // Focus the desktop panel (or mobile if desktop is hidden)
    const target = desktopRef.current ?? mobileRef.current;
    target?.focus();
  }, [entity]);

  if (!entity) return null;

  // Collapsed mode: render narrow strip instead of full panel (desktop only)
  if (collapsed) {
    return (
      <button
        onClick={onExpand}
        className={cn(
          'fixed z-30 overflow-hidden',
          'bg-black/60 backdrop-blur-xl',
          'border border-white/[0.08]',
          'shadow-lg shadow-black/30',
          'hidden md:flex md:items-center md:gap-2',
          'top-16 right-4',
          'w-[52px] rounded-xl px-0 py-3',
          'flex-col',
          'hover:bg-black/70 hover:border-white/[0.12] transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
        aria-label={`Expand ${entity.type} panel`}
        title="Expand panel"
      >
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">
          {entity.type === 'drep'
            ? 'DRep'
            : entity.type === 'proposal'
              ? 'Proposal'
              : entity.type === 'pool'
                ? 'Pool'
                : 'CC'}
        </span>
      </button>
    );
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/40 md:hidden animate-fade-in"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Desktop: right panel */}
      <div
        ref={desktopRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`${entity.type} details`}
        className={cn(
          'fixed z-30 overflow-hidden',
          'bg-black/75 backdrop-blur-2xl',
          'border border-white/[0.08]',
          'shadow-2xl shadow-black/40',
          'hidden md:flex md:flex-col',
          'top-16 right-4 bottom-4',
          'w-[400px] rounded-2xl',
          'animate-panel-slide-right',
        )}
      >
        <PanelHeader onClose={handleClose} />
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 scroll-smooth">
          <PanelContent entity={entity} />
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        ref={mobileRef}
        tabIndex={-1}
        role="dialog"
        aria-label={`${entity.type} details`}
        className={cn(
          'fixed z-30 overflow-hidden md:hidden',
          'bg-black/80 backdrop-blur-2xl',
          'border-t border-white/[0.08]',
          'shadow-2xl shadow-black/40',
          'inset-x-0 bottom-0',
          'max-h-[70vh] rounded-t-2xl',
          'flex flex-col',
          'animate-panel-slide-up',
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <PanelHeader onClose={handleClose} />
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6 scroll-smooth">
          <PanelContent entity={entity} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-end px-3 py-2 shrink-0">
      <button
        onClick={onClose}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          'text-muted-foreground hover:text-foreground',
          'hover:bg-white/[0.06]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface EntityInfo {
  type: 'drep' | 'proposal' | 'pool' | 'cc';
  id: string;
  secondaryId?: string;
}

function PanelContent({ entity }: { entity: EntityInfo }) {
  switch (entity.type) {
    case 'drep':
      return <DRepGlobePanel drepId={entity.id} />;
    case 'proposal':
      return <ProposalGlobePanel txHash={entity.id} index={Number(entity.secondaryId ?? 0)} />;
    case 'pool':
      return <PoolGlobePanel poolId={entity.id} />;
    case 'cc':
      return <CCMemberGlobePanel ccHotId={entity.id} />;
    default:
      return null;
  }
}
