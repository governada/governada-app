'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { motion, LayoutGroup, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import {
  getSidebarSections,
  type NavSection,
  type NavItem,
  type NavItemGroup,
} from '@/lib/nav/config';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { SidebarPinnedItems } from './SidebarPinnedItems';
import { useSidebarMetrics } from '@/hooks/useSidebarMetrics';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface GovernadaSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function GovernadaSidebar({ collapsed, onToggle }: GovernadaSidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { segment, stakeAddress, drepId, poolId, delegatedDrep, delegatedPool } = useSegment();
  const { depth } = useGovernanceDepth();
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);
  const prefersReducedMotion = useReducedMotion();

  const isDelegated = !!(delegatedDrep || delegatedPool);
  const sections = getSidebarSections({ segment, drepId, poolId, depth, isDelegated });
  const sidebarMetrics = useSidebarMetrics();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isSectionActive = (section: NavSection) => {
    if (section.href === '/') return pathname === '/';
    return pathname.startsWith(section.href);
  };

  const getBadgeCount = (item: NavItem): number => {
    if (item.badge === 'unread') return unreadCount;
    // TODO: implement action badge count (pending votes)
    return 0;
  };

  /** Render a single nav item link */
  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const badge = getBadgeCount(item);
    const sublabel = item.sublabelKey ? sidebarMetrics[item.sublabelKey] : undefined;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          active
            ? 'bg-accent text-foreground shadow-[0_0_12px_rgba(var(--primary-rgb,59,130,246),0.15)]'
            : 'text-muted-foreground',
          collapsed && 'justify-center px-0',
        )}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? t(item.label) : undefined}
      >
        {active &&
          (prefersReducedMotion ? (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
          ) : (
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          ))}
        <span className="relative inline-flex shrink-0">
          <item.icon className="h-4 w-4" />
          {badge > 0 && (
            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex flex-col min-w-0">
            <span className="truncate">{t(item.label)}</span>
            {sublabel ? (
              <span className="text-[10px] text-muted-foreground/60 truncate leading-tight">
                {sublabel}
              </span>
            ) : item.sublabelKey ? (
              <span className="h-2.5 w-10 bg-muted/20 rounded animate-pulse" />
            ) : null}
          </span>
        )}
      </Link>
    );
  };

  /** Render items for a section — flat list or role-grouped */
  const renderSectionItems = (section: NavSection) => {
    // Dual-role grouped workspace
    if (section.groups) {
      return (
        <div className="space-y-0.5">
          {section.groups.map((group: NavItemGroup, groupIdx: number) => (
            <div key={group.id}>
              {/* Role sub-header — subtle, small text */}
              {!collapsed && (
                <div
                  className={cn(
                    'px-3 py-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50',
                    groupIdx > 0 && 'mt-2',
                  )}
                >
                  {group.label}
                </div>
              )}
              {collapsed && groupIdx > 0 && (
                <div className="mx-3 my-1.5 border-t border-border/30" />
              )}
              {group.items.map(renderItem)}
            </div>
          ))}
        </div>
      );
    }

    // Standard flat items
    if (section.items) {
      return <div className="space-y-0.5">{section.items.map(renderItem)}</div>;
    }

    return null;
  };

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col fixed left-0 top-10 bottom-0 z-30 border-r border-border/20 bg-background/60 backdrop-blur-xl transition-[width] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Sidebar navigation">
        <LayoutGroup id="sidebar-nav">
          {sections.map((section, sectionIdx) => (
            <div
              key={section.id}
              className={cn(sectionIdx > 0 && 'mt-4 pt-3 border-t border-border/10')}
            >
              {/* Section header / single link */}
              {section.items || section.groups ? (
                <>
                  {/* Section label — clickable, with contextual sub-label */}
                  {!collapsed && (
                    <Link href={section.href} className="block px-3 py-1.5 group">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                        {t(section.label)}
                      </span>
                      {section.id === 'workspace' && (
                        <span className="block text-[9px] text-muted-foreground/40 leading-tight">
                          {t('Your actions')}
                        </span>
                      )}
                      {section.id === 'governance' && (
                        <span className="block text-[9px] text-muted-foreground/40 leading-tight">
                          {t("What's happening")}
                        </span>
                      )}
                      {section.id === 'you' && (
                        <span className="block text-[9px] text-muted-foreground/40 leading-tight">
                          {t('Your identity')}
                        </span>
                      )}
                    </Link>
                  )}
                  {collapsed && (
                    <Link
                      href={section.href}
                      className="flex justify-center py-1.5"
                      title={t(section.label)}
                    >
                      <section.icon className="h-4 w-4 text-muted-foreground/40 hover:text-muted-foreground transition-colors" />
                    </Link>
                  )}
                  {/* Sub-items (flat or grouped) */}
                  {renderSectionItems(section)}
                </>
              ) : (
                /* Single link section (Home, Delegation) */
                <Link
                  href={section.href}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                    isSectionActive(section)
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground',
                    collapsed && 'justify-center px-0',
                  )}
                  aria-current={isSectionActive(section) ? 'page' : undefined}
                  title={collapsed ? t(section.label) : undefined}
                >
                  {isSectionActive(section) &&
                    (prefersReducedMotion ? (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                    ) : (
                      <motion.span
                        layoutId="sidebar-active-indicator"
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    ))}
                  <section.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{t(section.label)}</span>}
                </Link>
              )}
            </div>
          ))}
          {/* Pinned entities */}
          <SidebarPinnedItems collapsed={collapsed} />
        </LayoutGroup>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 mr-2" />
              <span className="text-xs text-muted-foreground">{t('Collapse')}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
