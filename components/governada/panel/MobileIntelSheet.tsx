'use client';

/**
 * MobileIntelSheet — gesture-driven bottom sheet for mobile (<1024px).
 *
 * Replaces the desktop intelligence panel on smaller screens with a
 * native-feeling bottom sheet. Three states:
 *
 * 1. **Closed** — only the PeekBar is visible
 * 2. **Half sheet** (default open) — 50% screen height
 * 3. **Full sheet** — 85% screen height
 *
 * Interactions:
 * - Drag handle at top for resize
 * - Drag down past 30% threshold to close
 * - Drag up to expand from half -> full
 * - Tap outside (backdrop) to close
 * - Escape key to close
 * - Spring physics for momentum feel
 *
 * Respects `prefers-reduced-motion` and `safe-area-inset-bottom`.
 *
 * Feature-flagged behind `governance_copilot`.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { PeekBar } from './PeekBar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SheetState = 'closed' | 'half' | 'full';

interface MobileIntelSheetProps {
  /** Sheet content (same content as the desktop panel) */
  children: ReactNode;
  /** Additional class on the sheet container */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Half-sheet occupies 50% of viewport height */
const HALF_RATIO = 0.5;

/** Full-sheet occupies 85% of viewport height */
const FULL_RATIO = 0.85;

/** Drag down past this ratio of current height to close */
const CLOSE_THRESHOLD = 0.3;

/** Minimum velocity (px/s) for a flick to trigger state change */
const VELOCITY_THRESHOLD = 300;

/** Spring config for native-feeling transitions */
const SPRING_CONFIG = {
  type: 'spring' as const,
  damping: 28,
  stiffness: 320,
  mass: 0.7,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileIntelSheet({ children, className }: MobileIntelSheetProps) {
  const [state, setState] = useState<SheetState>('closed');
  const prefersReducedMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isOpen = state !== 'closed';

  // Motion value for drag offset
  const y = useMotionValue(0);

  // ---------------------------------------------------------------------------
  // Height calculations
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  const open = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setState('half');
    y.set(0);
  }, [y]);

  const close = useCallback(() => {
    setState('closed');
    y.set(0);
    // Restore focus
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [y]);

  const expand = useCallback(() => {
    setState('full');
    y.set(0);
  }, [y]);

  // ---------------------------------------------------------------------------
  // Drag handling
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const velocityY = info.velocity.y;
      const offsetY = info.offset.y;
      const currentHeight = getTargetHeight(state);

      if (state === 'half') {
        // Dragging DOWN from half sheet
        if (offsetY > currentHeight * CLOSE_THRESHOLD || velocityY > VELOCITY_THRESHOLD) {
          close();
          return;
        }
        // Dragging UP from half sheet
        if (offsetY < -50 || velocityY < -VELOCITY_THRESHOLD) {
          expand();
          return;
        }
      } else if (state === 'full') {
        // Dragging DOWN from full sheet
        if (velocityY > VELOCITY_THRESHOLD * 1.5) {
          // Fast swipe down = close entirely
          close();
          return;
        }
        if (offsetY > currentHeight * CLOSE_THRESHOLD) {
          // Slow drag past threshold = collapse to half
          setState('half');
          y.set(0);
          return;
        }
      }

      // Snap back
      y.set(0);
    },
    [state, getTargetHeight, close, expand, y],
  );

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  // ---------------------------------------------------------------------------
  // Body scroll lock when sheet is open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Focus sheet when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        sheetRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Animation config
  // ---------------------------------------------------------------------------

  const transition = prefersReducedMotion ? { duration: 0 } : SPRING_CONFIG;

  const targetHeight = getTargetHeight(state);

  return (
    <>
      {/* Peek bar — visible only when sheet is closed, on mobile only */}
      <PeekBar onOpen={open} isSheetOpen={isOpen} />

      {/* Sheet + backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 lg:hidden bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
              onClick={close}
              aria-hidden="true"
            />

            {/* Sheet */}
            <motion.aside
              ref={sheetRef}
              role="complementary"
              aria-label="Governance intelligence"
              tabIndex={-1}
              className={cn(
                'fixed left-0 right-0 bottom-0 z-50 lg:hidden',
                'rounded-t-2xl outline-none',
                'border-t border-border/20',
                'bg-background/90 backdrop-blur-xl',
                'flex flex-col',
                className,
              )}
              style={{
                height: targetHeight,
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
              // Animate in from bottom
              initial={{
                y: prefersReducedMotion ? 0 : '100%',
              }}
              animate={{
                y: 0,
                height: targetHeight,
              }}
              exit={{
                y: prefersReducedMotion ? 0 : '100%',
              }}
              transition={transition}
              // Drag behavior
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

              {/* State indicator (half/full) */}
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Intelligence
                </span>
                {state === 'half' && (
                  <button
                    type="button"
                    onClick={expand}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Expand to full height"
                  >
                    Expand
                  </button>
                )}
                {state === 'full' && (
                  <button
                    type="button"
                    onClick={() => {
                      setState('half');
                      y.set(0);
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Collapse to half height"
                  >
                    Collapse
                  </button>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
