'use client';

/**
 * GlobeControls — Floating control bar at the top of the globe.
 *
 * Toggle list overlay, cycle entity filter, zoom controls.
 * Glassmorphic pill shape that doesn't compete with the globe.
 */

import { cn } from '@/lib/utils';
import { List, Filter, RotateCcw } from 'lucide-react';
import type { GlobeFilter } from '@/lib/globe/urlState';

interface GlobeControlsProps {
  listOpen: boolean;
  onToggleList: () => void;
  activeFilter: GlobeFilter | null;
  onCycleFilter: () => void;
  onResetGlobe: () => void;
}

const FILTER_LABEL: Record<GlobeFilter, string> = {
  dreps: 'DReps',
  proposals: 'Proposals',
  spos: 'Pools',
  cc: 'Committee',
};

export function GlobeControls({
  listOpen,
  onToggleList,
  activeFilter,
  onCycleFilter,
  onResetGlobe,
}: GlobeControlsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded-full',
        'bg-black/60 backdrop-blur-xl border border-white/[0.08]',
        'shadow-lg shadow-black/30',
      )}
    >
      {/* List toggle */}
      <ControlButton
        icon={List}
        label={listOpen ? 'Hide list' : 'Show list'}
        isActive={listOpen}
        onClick={onToggleList}
        shortcut="L"
      />

      {/* Filter cycle */}
      <ControlButton
        icon={Filter}
        label={activeFilter ? FILTER_LABEL[activeFilter] : 'Filter'}
        isActive={!!activeFilter}
        onClick={onCycleFilter}
        shortcut="F"
      />

      {/* Reset globe */}
      <ControlButton icon={RotateCcw} label="Reset" onClick={onResetGlobe} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Control button
// ---------------------------------------------------------------------------

function ControlButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  shortcut,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-full text-xs transition-all duration-150',
        // Larger touch targets on mobile (44px min), compact on desktop
        'px-3 py-2.5 sm:px-2.5 sm:py-1.5',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
        isActive
          ? 'bg-white/15 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
      )}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
