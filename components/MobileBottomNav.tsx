'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/utils/wallet';
import { Compass, ScrollText, Vote, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Compass;
}

const BASE_ITEMS: NavItem[] = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/proposals', label: 'Proposals', icon: ScrollText },
];

const AUTH_ITEM: NavItem = {
  href: '/governance',
  label: 'My Delegation',
  icon: Vote,
};

const DREP_ITEM: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: Sparkles,
};

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isAuthenticated, ownDRepId } = useWallet();

  const items: NavItem[] = [...BASE_ITEMS];
  if (isAuthenticated) items.push(AUTH_ITEM);
  if (ownDRepId) items.push(DREP_ITEM);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-background/80 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-2 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
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
