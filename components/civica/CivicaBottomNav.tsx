'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Activity, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/pulse', label: 'Pulse', icon: Activity },
  { href: '/my-gov', label: 'My Gov', icon: Landmark },
] as const;

export function CivicaBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-background/80 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[44px] px-2 transition-colors [touch-action:manipulation]',
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
