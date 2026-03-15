'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pin, X, User, FileText, Building2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePinnedItems, type PinnedEntityType } from '@/hooks/usePinnedItems';
import { useTranslation } from '@/lib/i18n/useTranslation';

const ENTITY_ICONS: Record<PinnedEntityType, typeof User> = {
  drep: User,
  proposal: FileText,
  pool: Building2,
  cc: Shield,
};

function getEntityHref(type: PinnedEntityType, id: string): string {
  switch (type) {
    case 'drep':
      return `/drep/${encodeURIComponent(id)}`;
    case 'proposal':
      // id format: "txHash/index"
      return `/proposal/${id}`;
    case 'pool':
      return `/pool/${encodeURIComponent(id)}`;
    case 'cc':
      return `/governance/committee/${encodeURIComponent(id)}`;
  }
}

/**
 * Sidebar section showing user-pinned entities.
 * Renders at the bottom of the sidebar nav, above the collapse toggle.
 */
export function SidebarPinnedItems({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { pinnedItems, unpin } = usePinnedItems();

  if (pinnedItems.length === 0) return null;

  return (
    <div className="mt-4 border-t border-border/30 pt-3">
      {!collapsed && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          <Pin className="h-3 w-3" />
          {t('Pinned')}
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center py-1.5">
          <Pin className="h-3.5 w-3.5 text-muted-foreground/40" />
        </div>
      )}
      <div className="space-y-0.5">
        {pinnedItems.map((item) => {
          const href = getEntityHref(item.type, item.id);
          const active = pathname === href || pathname.startsWith(href + '/');
          const Icon = ENTITY_ICONS[item.type];

          return (
            <div key={`${item.type}-${item.id}`} className="group relative flex items-center">
              <Link
                href={href}
                className={cn(
                  'flex flex-1 items-center gap-3 rounded-md px-3 py-1.5 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  active ? 'bg-accent text-foreground' : 'text-muted-foreground',
                  collapsed && 'justify-center px-0',
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span className="truncate text-xs">{item.label}</span>}
              </Link>
              {!collapsed && (
                <button
                  onClick={() => unpin(item.type, item.id)}
                  className="absolute right-1 opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground/50 hover:text-foreground transition-opacity"
                  aria-label={`Unpin ${item.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
