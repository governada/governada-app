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
import { getSidebarSections, getCurrentSection, SECTION_METRIC_KEYS } from '@/lib/nav/config';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { usePinnedItems, type PinnedEntityType } from '@/hooks/usePinnedItems';
import { useSidebarMetrics } from '@/hooks/useSidebarMetrics';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User, FileText, Building2, Shield } from 'lucide-react';
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

export function NavigationRail() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { segment, drepId, poolId, delegatedDrep, delegatedPool } = useSegment();
  const { depth } = useGovernanceDepth();
  const prefersReducedMotion = useReducedMotion();
  const { pinnedItems } = usePinnedItems();
  const metrics = useSidebarMetrics();

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
        className="hidden lg:flex flex-col items-center fixed left-0 top-0 bottom-0 w-12 z-40 border-r border-border/10 bg-background/20 backdrop-blur-md"
        aria-label={t('Main navigation')}
      >
        {/* Logo — top of rail */}
        <Link
          href="/"
          className="flex items-center justify-center w-12 h-10 shrink-0 text-foreground hover:bg-accent/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          aria-label="Governada home"
        >
          <span className="font-display text-sm font-bold tracking-tight">g</span>
        </Link>

        {/* Navigation icons */}
        <nav
          className="flex flex-col items-center gap-1 pt-1"
          role="navigation"
          aria-label={t('Main navigation')}
        >
          <LayoutGroup id="rail-nav">
            {sections.map((section) => {
              const isActive = currentSection === section.id;
              const shortcut = SECTION_SHORTCUTS[section.id] ?? '';
              const metricKey = SECTION_METRIC_KEYS[section.id];
              const metricValue = metricKey ? metrics[metricKey] : undefined;
              const tooltipLabel = [
                t(section.label),
                metricValue ? `— ${metricValue}` : null,
                shortcut ? `· ${shortcut}` : null,
              ]
                .filter(Boolean)
                .join(' ');
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
                      <section.icon className="h-[22px] w-[22px]" />

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

                      {/* Notification badge removed — bell in header handles notifications */}

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
