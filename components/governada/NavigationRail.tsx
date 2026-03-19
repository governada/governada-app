'use client';

/**
 * NavigationRail — 48px fixed-width icon rail replacing the 240px sidebar.
 *
 * Four Worlds: Home, Workspace, Governance, You
 * Feature-flagged behind `navigation_rail`.
 *
 * - Radix tooltips with keyboard shortcut hints
 * - Spring-animated active indicator dot (with reduced-motion fallback)
 * - Compact pinned entities section at bottom
 * - Full accessibility: aria-labels, aria-current, keyboard nav via tab order
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getSidebarSections, getCurrentSection } from '@/lib/nav/config';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { usePinnedItems, type PinnedEntityType } from '@/hooks/usePinnedItems';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User, FileText, Building2, Shield, BrainCircuit } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Keyboard shortcut hints per section id */
const SECTION_SHORTCUTS: Record<string, string> = {
  home: 'G H',
  workspace: 'G W',
  governance: 'G G',
  you: 'G Y',
};

/** Entity type icons for pinned items */
const ENTITY_ICONS: Record<PinnedEntityType, LucideIcon> = {
  drep: User,
  proposal: FileText,
  pool: Building2,
  cc: Shield,
};

/** Build href for a pinned entity */
function getEntityHref(type: PinnedEntityType, id: string): string {
  switch (type) {
    case 'drep':
      return `/drep/${encodeURIComponent(id)}`;
    case 'proposal':
      return `/proposal/${id}`;
    case 'pool':
      return `/pool/${encodeURIComponent(id)}`;
    case 'cc':
      return `/governance/committee/${encodeURIComponent(id)}`;
  }
}

/** Max pinned items shown in the rail */
const MAX_RAIL_PINS = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NavigationRailProps {
  /** Callback to toggle the Co-Pilot panel (only present when governance_copilot flag is on) */
  onToggleCopilot?: () => void;
  /** Whether the Co-Pilot panel is currently open */
  copilotOpen?: boolean;
}

export function NavigationRail({ onToggleCopilot, copilotOpen }: NavigationRailProps = {}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { segment, stakeAddress, drepId, poolId, delegatedDrep, delegatedPool } = useSegment();
  const { depth } = useGovernanceDepth();
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);
  const prefersReducedMotion = useReducedMotion();
  const { pinnedItems } = usePinnedItems();

  const isDelegated = !!(delegatedDrep || delegatedPool);
  const sections = getSidebarSections({ segment, drepId, poolId, depth, isDelegated });
  const currentSection = getCurrentSection(pathname);

  const isDualRole = !!(drepId && poolId);

  // Limit pinned items for compact display
  const visiblePins = pinnedItems.slice(0, MAX_RAIL_PINS);
  const overflowCount = pinnedItems.length - MAX_RAIL_PINS;

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className="hidden lg:flex flex-col items-center fixed left-0 top-10 bottom-0 w-12 z-30 border-r border-border/20 bg-background/60 backdrop-blur-xl"
        aria-label={t('Main navigation')}
      >
        {/* Navigation icons */}
        <nav
          className="flex flex-col items-center gap-1 pt-3"
          role="navigation"
          aria-label={t('Main navigation')}
        >
          <LayoutGroup id="rail-nav">
            {sections.map((section) => {
              const isActive = currentSection === section.id;
              const shortcut = SECTION_SHORTCUTS[section.id] ?? '';
              const tooltipLabel = shortcut
                ? `${t(section.label)} \u00B7 ${shortcut}`
                : t(section.label);
              const ariaLabel = shortcut ? `${t(section.label)} (${shortcut})` : t(section.label);

              return (
                <Tooltip key={section.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={section.href}
                      className={cn(
                        'relative w-12 h-12 flex items-center justify-center rounded-lg transition-colors',
                        'hover:bg-accent/50',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                        isActive && 'text-foreground',
                        !isActive && 'text-muted-foreground',
                      )}
                      aria-label={ariaLabel}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <section.icon className="h-5 w-5" />

                      {/* Active indicator dot */}
                      {isActive &&
                        (prefersReducedMotion ? (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                        ) : (
                          <motion.span
                            layoutId="rail-indicator"
                            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          />
                        ))}

                      {/* Notification badge on You */}
                      {section.id === 'you' && unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
                      )}

                      {/* Dual-role badge on Workspace */}
                      {section.id === 'workspace' && isDualRole && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                          2
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {tooltipLabel}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </LayoutGroup>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Co-Pilot toggle */}
        {onToggleCopilot && (
          <div className="flex flex-col items-center pb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCopilot}
                  className={cn(
                    'relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors',
                    'hover:bg-accent/50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    copilotOpen ? 'text-primary bg-primary/10' : 'text-muted-foreground',
                  )}
                  aria-label={copilotOpen ? 'Close intelligence panel' : 'Open intelligence panel'}
                  aria-pressed={copilotOpen}
                >
                  <BrainCircuit className="h-4.5 w-4.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {t('Co-Pilot')} &middot; ]
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Pinned entities */}
        {visiblePins.length > 0 && (
          <div className="flex flex-col items-center gap-1.5 pb-3">
            <div className="border-t border-border/30 w-8 mb-1" />
            {visiblePins.map((item) => {
              const href = getEntityHref(item.type, item.id);
              const Icon = ENTITY_ICONS[item.type];
              const firstLetter = item.label.charAt(0).toUpperCase();

              return (
                <Tooltip key={`${item.type}-${item.id}`}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={cn(
                        'w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center transition-colors',
                        'hover:bg-accent/50',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      )}
                      aria-label={`${t('Go to')} ${item.label}`}
                    >
                      {/* Show entity icon at small size as a visual type hint, overlaid with first letter */}
                      <span className="relative">
                        <Icon className="h-3 w-3 opacity-0 absolute" aria-hidden="true" />
                        <span className="text-xs font-medium">{firstLetter}</span>
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {/* Overflow indicator */}
            {overflowCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                    +{overflowCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {`${overflowCount} ${t('more pinned')}`}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
