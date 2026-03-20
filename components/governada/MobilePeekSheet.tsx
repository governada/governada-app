'use client';

/**
 * MobilePeekSheet — long-press triggered bottom sheet for entity previews.
 *
 * Three states:
 * - Closed (hidden)
 * - Half (50% viewport height) — default on open
 * - Full (85% viewport height) — swipe up to expand
 *
 * Swipe down to dismiss. Includes "Open full" button that navigates
 * to the entity's full page.
 *
 * Mobile only (lg:hidden). Spring animations. Respects prefers-reduced-motion.
 * Feature-flagged behind `mobile_gestures`.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import { ExternalLink, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetState = 'closed' | 'half' | 'full';

export interface MobilePeekSheetProps {
  /** Whether the sheet is open */
  isOpen: boolean;
  /** Close callback */
  onClose: () => void;
  /** Full-page URL for the entity */
  entityHref?: string;
  /** Entity title for the header */
  entityTitle?: string;
  /** Sheet content */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HALF_RATIO = 0.5;
const FULL_RATIO = 0.85;
const CLOSE_THRESHOLD = 0.3;
const VELOCITY_THRESHOLD = 300;

const SPRING_CONFIG = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 350,
  mass: 0.8,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobilePeekSheet({
  isOpen,
  onClose,
  entityHref,
  entityTitle,
  children,
}: MobilePeekSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const prefersReducedMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const y = useMotionValue(0);

  // Reset to half when opened
  useEffect(() => {
    if (isOpen) {
      setSheetState('half');
      previousFocusRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  const getTargetHeight = useCallback((s: SheetState): number => {
    if (typeof window === 'undefined') return 0;
    const vh = window.innerHeight;
    switch (s) {
      case 'half':
        return vh * HALF_RATIO;
      case 'full':
        return vh * FULL_RATIO;
      default:
        return 0;
    }
  }, []);

  const close = useCallback(() => {
    onClose();
    y.set(0);
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [onClose, y]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const velocityY = info.velocity.y;
      const offsetY = info.offset.y;
      const currentHeight = getTargetHeight(sheetState);

      if (sheetState === 'half') {
        if (offsetY > currentHeight * CLOSE_THRESHOLD || velocityY > VELOCITY_THRESHOLD) {
          close();
          return;
        }
        if (offsetY < -50 || velocityY < -VELOCITY_THRESHOLD) {
          setSheetState('full');
          y.set(0);
          return;
        }
      } else if (sheetState === 'full') {
        if (velocityY > VELOCITY_THRESHOLD * 1.5) {
          close();
          return;
        }
        if (offsetY > currentHeight * CLOSE_THRESHOLD) {
          setSheetState('half');
          y.set(0);
          return;
        }
      }

      y.set(0);
    },
    [sheetState, getTargetHeight, close, y],
  );

  // Escape to close
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

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Focus sheet
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => sheetRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const transition = prefersReducedMotion ? { duration: 0 } : SPRING_CONFIG;
  const targetHeight = getTargetHeight(sheetState);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 lg:hidden bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            onClick={close}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-label={entityTitle ? `Preview: ${entityTitle}` : 'Entity preview'}
            aria-modal="true"
            tabIndex={-1}
            className={cn(
              'fixed left-0 right-0 bottom-0 z-50 lg:hidden',
              'rounded-t-2xl outline-none',
              'border-t border-border/20',
              'bg-background/90 backdrop-blur-xl',
              'flex flex-col',
            )}
            style={{
              height: targetHeight,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
            initial={{ y: prefersReducedMotion ? 0 : '100%' }}
            animate={{ y: 0, height: targetHeight }}
            exit={{ y: prefersReducedMotion ? 0 : '100%' }}
            transition={transition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            _dragY={y}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-2.5 pb-1.5 cursor-grab active:cursor-grabbing touch-none"
              aria-hidden="true"
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm font-semibold text-foreground truncate flex-1">
                {entityTitle ?? 'Preview'}
              </span>
              <div className="flex items-center gap-1">
                {entityHref && (
                  <Link
                    href={entityHref}
                    onClick={close}
                    className={cn(
                      'p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                      'text-primary hover:bg-primary/10',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    )}
                    aria-label="Open full page"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={close}
                  className={cn(
                    'p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
                    'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                  aria-label="Close preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
