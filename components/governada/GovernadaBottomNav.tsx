'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup, useReducedMotion } from 'framer-motion';
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
  const prefersReducedMotion = useReducedMotion();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    // All /workspace/* routes highlight the Workspace bottom bar item,
    // regardless of whether the item's href is /workspace or /workspace/author.
    if (href.startsWith('/workspace') && pathname.startsWith('/workspace')) return true;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-background/60 backdrop-blur-xl border-t border-border/30 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <LayoutGroup id="bottomnav">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = isActive(href);
            const badgeCount = badge === 'unread' ? unreadCount : 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 px-2 transition-colors [touch-action:manipulation]',
                  // Each item gets 33% width for 3 items, min 44px touch target
                  'flex-1 min-h-[48px] min-w-[44px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded',
                  active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
                aria-label={t(label)}
              >
                {/* Active pill background */}
                {active &&
                  (prefersReducedMotion ? (
                    <span className="absolute inset-x-3 top-1 bottom-1 rounded-xl bg-primary/10" />
                  ) : (
                    <motion.span
                      layoutId="bottomnav-active-pill"
                      className="absolute inset-x-3 top-1 bottom-1 rounded-xl bg-primary/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  ))}

                <div className="relative z-10 inline-flex">
                  {/* Larger icon: 24px instead of 20px */}
                  <Icon className="h-6 w-6" />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-0.5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className="relative z-10 text-[10px] font-medium leading-tight">
                  {t(label)}
                </span>
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
