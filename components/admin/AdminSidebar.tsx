'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Database,
  Flag,
  LayoutDashboard,
  Shield,
  TrendingUp,
  Vote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: 'Pipeline',
    href: '/admin/pipeline',
    icon: Activity,
  },
  {
    label: 'Governance',
    href: '/admin/governance',
    icon: TrendingUp,
  },
  {
    label: 'Data Quality',
    href: '/admin/quality',
    icon: Database,
  },
  { type: 'divider' as const },
  {
    label: 'Integrity',
    href: '/admin/integrity',
    icon: Shield,
  },
  {
    label: 'Feature Flags',
    href: '/admin/flags',
    icon: Flag,
  },
  {
    label: 'Assemblies',
    href: '/admin/assemblies',
    icon: Vote,
  },
] as const;

type NavItem =
  | { label: string; href: string; icon: typeof LayoutDashboard; exact?: boolean }
  | { type: 'divider' };

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(item: NavItem): boolean {
    if ('type' in item) return false;
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border/50 bg-card/30">
      <div className="p-4 pb-2">
        <div className="flex items-center gap-2 px-2">
          <BarChart3 className="h-4 w-4 text-chart-1" />
          <span className="text-sm font-semibold tracking-tight">Ops Dashboard</span>
        </div>
      </div>
      <nav aria-label="Admin navigation" className="px-2 pb-4 space-y-0.5">
        {(NAV_ITEMS as readonly NavItem[]).map((item, i) => {
          if ('type' in item) {
            return <div key={i} className="my-2 border-t border-border/40" />;
          }
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
