'use client';

/**
 * EntityDetailSheet — Unified entity detail panel for the homepage.
 *
 * Desktop: Right side panel (400px, glassmorphic).
 * Mobile: Bottom sheet via Radix Sheet.
 *
 * Reuses existing globe panel components for entity content.
 */

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { EntityRef } from '@/lib/homepage/parseEntityParam';
import { getEntityPageUrl } from '@/lib/homepage/parseEntityParam';

const DRepGlobePanel = dynamic(
  () => import('@/components/globe/DRepGlobePanel').then((m) => ({ default: m.DRepGlobePanel })),
  { ssr: false },
);

const ProposalGlobePanel = dynamic(
  () =>
    import('@/components/globe/ProposalGlobePanel').then((m) => ({
      default: m.ProposalGlobePanel,
    })),
  { ssr: false },
);

const PoolGlobePanel = dynamic(
  () => import('@/components/globe/PoolGlobePanel').then((m) => ({ default: m.PoolGlobePanel })),
  { ssr: false },
);

const CCMemberGlobePanel = dynamic(
  () =>
    import('@/components/globe/CCMemberGlobePanel').then((m) => ({
      default: m.CCMemberGlobePanel,
    })),
  { ssr: false },
);

interface EntityDetailSheetProps {
  entity: EntityRef | null;
  onClose: () => void;
}

function EntityContent({ entity }: { entity: EntityRef }) {
  switch (entity.type) {
    case 'drep':
      return <DRepGlobePanel drepId={entity.id} />;
    case 'proposal':
      return (
        <ProposalGlobePanel txHash={entity.id} index={parseInt(entity.secondaryId ?? '0', 10)} />
      );
    case 'pool':
      return <PoolGlobePanel poolId={entity.id} />;
    case 'cc':
      return <CCMemberGlobePanel ccHotId={entity.id} />;
  }
}

const TYPE_LABELS: Record<string, string> = {
  drep: 'DRep',
  proposal: 'Proposal',
  pool: 'Stake Pool',
  cc: 'CC Member',
};

export function EntityDetailSheet({ entity, onClose }: EntityDetailSheetProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isOpen = entity !== null;

  const handleEscape = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  // Mobile: Radix bottom sheet
  if (!isDesktop) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[75vh] rounded-t-2xl bg-background/95 backdrop-blur-xl border-t border-white/10 px-0"
          showCloseButton={false}
        >
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <div className="w-8 h-1 rounded-full bg-white/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pb-2">
            <span className="text-xs text-muted-foreground">{TYPE_LABELS[entity.type]}</span>
            <div className="flex items-center gap-2">
              <Link
                href={getEntityPageUrl(entity)}
                className="flex items-center gap-1 text-xs text-compass-teal hover:underline"
              >
                Full page <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/5 text-muted-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-4 pb-6 max-h-[calc(75vh-4rem)]">
            <EntityContent entity={entity} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Right side panel (animated)
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="entity-detail-desktop"
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onKeyDown={handleEscape}
          tabIndex={-1}
          className={cn(
            'fixed top-14 right-4 bottom-20 z-40',
            'w-[400px]',
            'backdrop-blur-2xl bg-black/75 border border-white/[0.08]',
            'rounded-2xl shadow-2xl shadow-black/40',
            'flex flex-col overflow-hidden',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-xs font-medium text-muted-foreground">
              {TYPE_LABELS[entity.type]}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={getEntityPageUrl(entity)}
                className="flex items-center gap-1 text-xs text-compass-teal hover:underline"
              >
                Full page <ExternalLink className="h-3 w-3" />
              </Link>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-white/5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                aria-label="Close entity detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <EntityContent entity={entity} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
