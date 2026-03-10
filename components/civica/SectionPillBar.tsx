'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getPillBarItems } from '@/lib/nav/config';

interface SectionPillBarProps {
  section: string;
}

/**
 * Horizontal scrollable pill bar for section sub-pages.
 * Renders below the page header on mobile, hidden on desktop (sidebar handles it).
 */
export function SectionPillBar({ section: _section }: SectionPillBarProps) {
  const pathname = usePathname();
  const { segment, drepId, poolId } = useSegment();
  const items = getPillBarItems(pathname, segment, { drepId, poolId });

  if (!items || items.length < 2) return null;

  return (
    <div className="sticky top-14 z-20 lg:hidden border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <nav
        className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none"
        aria-label="Section navigation"
      >
        {items.map((item) => {
          const active =
            item.href === pathname ||
            (item.href !== '/' && pathname.startsWith(item.href + '/')) ||
            // Handle exact sub-page match (e.g., /governance/proposals is active for /governance/proposals)
            pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
