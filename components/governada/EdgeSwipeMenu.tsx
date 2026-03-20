'use client';

/**
 * EdgeSwipeMenu — left-edge swipe reveals full navigation sheet on mobile.
 *
 * Activates when a touch starts within a 20px zone from the left edge.
 * Renders a bottom-sheet-style navigation menu with all section links +
 * sub-pages for the current section.
 *
 * Constraints:
 * - 20px edge zone only (avoids browser back gesture)
 * - Mobile only (lg:hidden)
 * - Respects prefers-reduced-motion
 * - Feature-flagged behind `mobile_gestures`
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getSidebarSections, type NavSection } from '@/lib/nav/config';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useTranslation } from '@/lib/i18n/useTranslation';

const EDGE_ZONE = 20; // px from left edge
const MIN_SWIPE_DISTANCE = 40; // px to trigger menu open
const SPRING_CONFIG = {
  type: 'spring' as const,
  damping: 28,
  stiffness: 300,
  mass: 0.8,
};

export function EdgeSwipeMenu({ enabled }: { enabled: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();
  const { segment, drepId, poolId } = useSegment();
  const { depth } = useGovernanceDepth();
  const prefersReducedMotion = useReducedMotion();
  const startXRef = useRef(0);
  const trackingRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const sections = getSidebarSections({
    segment,
    drepId: drepId ?? undefined,
    poolId: poolId ?? undefined,
    depth,
  });

  const close = useCallback(() => setIsOpen(false), []);

  // Edge swipe detection
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    const isMobile = window.matchMedia('(max-width: 1023px)').matches;
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      if (touch.clientX <= EDGE_ZONE) {
        startXRef.current = touch.clientX;
        trackingRef.current = true;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!trackingRef.current) return;
      trackingRef.current = false;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startXRef.current;
      if (dx > MIN_SWIPE_DISTANCE) {
        setIsOpen(true);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // Close on navigation
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => menuRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const transition = prefersReducedMotion ? { duration: 0 } : SPRING_CONFIG;

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 lg:hidden bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            onClick={close}
            aria-hidden="true"
          />

          {/* Menu sheet — slides from left */}
          <motion.nav
            ref={menuRef}
            role="navigation"
            aria-label="Full navigation menu"
            tabIndex={-1}
            className={cn(
              'fixed left-0 top-0 bottom-0 z-50 lg:hidden',
              'w-[280px] max-w-[80vw]',
              'bg-background/95 backdrop-blur-xl',
              'border-r border-border/20',
              'flex flex-col outline-none',
              'pb-[env(safe-area-inset-bottom)]',
            )}
            initial={{ x: prefersReducedMotion ? 0 : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: prefersReducedMotion ? 0 : '-100%' }}
            transition={transition}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top,12px)] pb-2 border-b border-border/20">
              <span className="text-sm font-semibold text-foreground">Navigation</span>
              <button
                onClick={close}
                className={cn(
                  'p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto py-2">
              {sections.map((section: NavSection) => (
                <div key={section.id} className="mb-2">
                  {/* Section header link */}
                  <Link
                    href={section.href}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 min-h-[44px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-lg mx-2',
                      isActive(section.href)
                        ? 'text-primary bg-primary/10'
                        : 'text-foreground hover:bg-muted/50',
                    )}
                    aria-current={isActive(section.href) ? 'page' : undefined}
                  >
                    <section.icon className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium">{t(section.label)}</span>
                  </Link>

                  {/* Sub-items */}
                  {section.items && section.items.length > 0 && (
                    <div className="ml-8 mt-0.5 space-y-0.5">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded-md mx-2 transition-colors text-sm',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            isActive(item.href)
                              ? 'text-primary bg-primary/5'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                          )}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{t(item.label)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
