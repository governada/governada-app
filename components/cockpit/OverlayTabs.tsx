'use client';

/**
 * OverlayTabs — Bottom-center tab bar for switching cockpit overlays.
 *
 * 4 tabs (Urgent | Network | Proposals | Ecosystem) drive the entire
 * HUD: globe recolors, action rail filters, Seneca strip updates,
 * and status metrics swap — all via cockpitStore.setOverlay().
 *
 * Keyboard shortcuts 1-4 switch overlays when no input is focused.
 * Boot sequence: slides up from below with configurable delay.
 */

import { useEffect, useCallback } from 'react';
import { motion, useReducedMotion, LayoutGroup } from 'framer-motion';
import { Zap, Network, ScrollText, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useGovernadaSound } from '@/hooks/useGovernadaSound';
import { OVERLAY_CONFIGS, OVERLAY_ORDER, SHORTCUT_TO_OVERLAY } from '@/lib/cockpit/overlayConfigs';
import type { CockpitOverlay } from '@/lib/cockpit/types';

// ---------------------------------------------------------------------------
// Icon mapping — maps config icon strings to Lucide components
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  network: Network,
  'scroll-text': ScrollText,
  globe: Globe,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OverlayTabsProps {
  /** Boot stagger delay in ms (default: 2000 from BOOT_SEQUENCE) */
  bootDelay?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverlayTabs({ bootDelay = 2000 }: OverlayTabsProps) {
  const activeOverlay = useCockpitStore((s) => s.activeOverlay);
  const bootPhase = useCockpitStore((s) => s.bootPhase);
  const setOverlay = useCockpitStore((s) => s.setOverlay);
  const prefersReducedMotion = useReducedMotion();
  const { playWhoosh } = useGovernadaSound();

  // -------------------------------------------------------------------------
  // Keyboard shortcuts (1-4)
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip when user is typing in an input or textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Also skip if activeElement has contentEditable
      if ((document.activeElement as HTMLElement)?.isContentEditable) return;

      const overlay = SHORTCUT_TO_OVERLAY[e.key];
      if (overlay) {
        e.preventDefault();
        setOverlay(overlay);
        playWhoosh();
      }
    },
    [setOverlay, playWhoosh],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // -------------------------------------------------------------------------
  // Boot animation variants
  // -------------------------------------------------------------------------

  const isBooting = bootPhase === 'cascade' || bootPhase === 'pending';

  const containerVariants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            delay: isBooting ? bootDelay / 1000 : 0,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        },
      };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <motion.div
      className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      role="tablist"
      aria-label="Cockpit overlay tabs"
    >
      <LayoutGroup id="overlay-tabs">
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-1.5',
            'rounded-full bg-black/60 backdrop-blur-md',
            'border border-white/10',
            'shadow-lg shadow-black/20',
          )}
        >
          {OVERLAY_ORDER.map((overlay) => {
            const config = OVERLAY_CONFIGS[overlay];
            const Icon = ICON_MAP[config.icon] ?? Globe;
            const isActive = activeOverlay === overlay;

            return (
              <OverlayTab
                key={overlay}
                overlay={overlay}
                label={config.label}
                shortcutKey={config.shortcutKey}
                Icon={Icon}
                isActive={isActive}
                onClick={() => {
                  setOverlay(overlay);
                  playWhoosh();
                }}
                prefersReducedMotion={!!prefersReducedMotion}
              />
            );
          })}
        </div>
      </LayoutGroup>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Individual tab button
// ---------------------------------------------------------------------------

interface OverlayTabProps {
  overlay: CockpitOverlay;
  label: string;
  shortcutKey: string;
  Icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
  prefersReducedMotion: boolean;
}

function OverlayTab({
  overlay,
  label,
  shortcutKey,
  Icon,
  isActive,
  onClick,
  prefersReducedMotion,
}: OverlayTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={`${overlay} overlay`}
      className={cn(
        'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-compass-teal/50 focus-visible:ring-offset-1 focus-visible:ring-offset-black/60',
        'min-w-[48px]',
        isActive ? 'text-compass-teal' : 'text-muted-foreground/50 hover:text-muted-foreground',
      )}
      onClick={onClick}
    >
      {/* Active background indicator — slides between tabs via layoutId */}
      {isActive &&
        (prefersReducedMotion ? (
          <span className="absolute inset-0 rounded-full bg-white/10" />
        ) : (
          <motion.span
            layoutId="overlay-tab-active"
            className="absolute inset-0 rounded-full bg-white/10"
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        ))}

      {/* Icon */}
      <span className="relative z-10">
        <Icon className="h-4 w-4" />
      </span>

      {/* Label */}
      <span className="relative z-10 text-[10px] font-medium leading-none">{label}</span>

      {/* Keyboard shortcut hint */}
      <span className="relative z-10 text-[9px] leading-none text-muted-foreground/30">
        {shortcutKey}
      </span>
    </button>
  );
}
