'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { getBottomBarItems } from '@/lib/nav/config';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useTranslation } from '@/lib/i18n/useTranslation';

export function GovernadaBottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { segment, stakeAddress } = useSegment();
  const { depth } = useGovernanceDepth();
  const unreadCount = useUnreadNotifications(stakeAddress ?? null);

  const navItems = getBottomBarItems({ segment, depth });

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-background/60 backdrop-blur-xl border-t border-border/30 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          const badgeCount = badge === 'unread' ? unreadCount : 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-2 transition-colors [touch-action:manipulation]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded',
                active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
              aria-label={t(label)}
            >
              <div className="relative inline-flex">
                <Icon className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{t(label)}</span>
              {active && (
                <span className="absolute bottom-[calc(env(safe-area-inset-bottom)+2px)] h-0.5 w-6 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
