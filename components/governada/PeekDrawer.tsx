'use client';

/**
 * PeekDrawer — slide-in panel for entity previews on list pages.
 *
 * 400px from right on desktop, bottom sheet on mobile.
 * Glassmorphic: bg-background/60 backdrop-blur-xl border-l border-border/20
 * Feature-flagged behind `peek_drawer`.
 *
 * Respects `prefers-reduced-motion` — instant show/hide instead of slide.
 */

import { useEffect, useCallback, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PeekDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible label for the drawer panel */
  ariaLabel?: string;
}

const SLIDE_DURATION = 0.2;

export function PeekDrawer({ isOpen, onClose, children, ariaLabel }: PeekDrawerProps) {
  const prefersReducedMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    },
    [isOpen, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus management: trap focus when opened, restore when closed
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Small delay so the animation has started
      const timer = setTimeout(() => {
        panelRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Close on click outside (backdrop)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const duration = prefersReducedMotion ? 0 : SLIDE_DURATION;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — mobile only (desktop has transparent backdrop for click-outside) */}
          <motion.div
            className="fixed inset-0 z-40 lg:bg-transparent bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            onClick={handleBackdropClick}
            aria-hidden="true"
          />

          {/* Desktop: slide from right */}
          <motion.aside
            ref={panelRef}
            role="complementary"
            aria-label={ariaLabel ?? 'Entity preview'}
            tabIndex={-1}
            className={cn(
              'fixed z-50 outline-none',
              // Desktop: right panel
              'hidden lg:flex lg:flex-col lg:right-0 lg:top-10 lg:bottom-0 lg:w-[400px]',
              'lg:border-l lg:border-border/20',
              'bg-background/60 backdrop-blur-xl',
            )}
            initial={{ x: prefersReducedMotion ? 0 : 400, opacity: prefersReducedMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: prefersReducedMotion ? 0 : 400, opacity: prefersReducedMotion ? 0 : 1 }}
            transition={{
              duration,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Close button */}
            <div className="flex items-center justify-end px-4 pt-3 pb-1">
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.aside>

          {/* Mobile: bottom sheet */}
          <motion.aside
            role="complementary"
            aria-label={ariaLabel ?? 'Entity preview'}
            tabIndex={-1}
            className={cn(
              'fixed z-50 outline-none lg:hidden',
              'left-0 right-0 bottom-0',
              'max-h-[60vh] rounded-t-2xl',
              'border-t border-border/20',
              'bg-background/80 backdrop-blur-xl',
            )}
            initial={{
              y: prefersReducedMotion ? 0 : '100%',
              opacity: prefersReducedMotion ? 0 : 1,
            }}
            animate={{ y: 0, opacity: 1 }}
            exit={{
              y: prefersReducedMotion ? 0 : '100%',
              opacity: prefersReducedMotion ? 0 : 1,
            }}
            transition={{
              duration,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Close button */}
            <div className="flex items-center justify-end px-4 pb-1">
              <button
                onClick={onClose}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-5 pb-5 max-h-[calc(60vh-48px)]">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
