'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScrollText, Activity, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/proposals', label: 'Proposals', icon: ScrollText },
  { href: '/pulse', label: 'Pulse', icon: Activity },
  { href: '/treasury', label: 'Treasury', icon: Landmark },
] as const;

export function GovernanceSubNav() {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory border-b border-border/50 mb-6 -mt-2"
      aria-label="Governance section navigation"
    >
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px snap-start min-h-[44px]',
            isActive(href)
              ? 'border-primary text-foreground font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
