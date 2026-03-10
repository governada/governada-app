'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getSidebarSections, type NavSection, type NavItem } from '@/lib/nav/config';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { Button } from '@/components/ui/button';

interface CivicaSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function CivicaSidebar({ collapsed, onToggle }: CivicaSidebarProps) {
  const pathname = usePathname();
  const { segment, stakeAddress } = useSegment();
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);

  const sections = getSidebarSections(segment);

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

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col fixed left-0 top-14 bottom-0 z-30 border-r border-border/50 bg-background transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Sidebar navigation">
        {sections.map((section, sectionIdx) => (
          <div key={section.id} className={cn(sectionIdx > 0 && 'mt-4')}>
            {/* Section header / single link */}
            {section.items ? (
              <>
                {/* Section label (not clickable) */}
                {!collapsed && (
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {section.label}
                  </div>
                )}
                {collapsed && (
                  <div className="flex justify-center py-1.5">
                    <section.icon className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                {/* Sub-items */}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const badge = getBadgeCount(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          'hover:bg-accent hover:text-accent-foreground',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                          active ? 'bg-accent text-foreground' : 'text-muted-foreground',
                          collapsed && 'justify-center px-0',
                        )}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                      >
                        {active && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                        )}
                        <span className="relative inline-flex shrink-0">
                          <item.icon className="h-4 w-4" />
                          {badge > 0 && (
                            <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                              {badge > 9 ? '9+' : badge}
                            </span>
                          )}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Single link section (Home, Delegation) */
              <Link
                href={section.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isSectionActive(section) ? 'bg-accent text-foreground' : 'text-muted-foreground',
                  collapsed && 'justify-center px-0',
                )}
                aria-current={isSectionActive(section) ? 'page' : undefined}
                title={collapsed ? section.label : undefined}
              >
                {isSectionActive(section) && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                )}
                <section.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{section.label}</span>}
              </Link>
            )}
          </div>
        ))}
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
              <span className="text-xs text-muted-foreground">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
