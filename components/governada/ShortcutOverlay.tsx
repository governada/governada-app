'use client';

/**
 * ShortcutOverlay — Full-screen keyboard shortcut help overlay.
 *
 * Triggered by pressing `?` or dispatching `openShortcutsHelp` event.
 * Groups shortcuts by category with glassmorphic card layout.
 * Respects `prefers-reduced-motion` for animations.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useShortcuts } from './ShortcutProvider';
import { formatShortcutKeys, type ShortcutCategory } from '@/lib/shortcuts';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Category display config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<ShortcutCategory, { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 0 },
  actions: { label: 'Actions', order: 1 },
  panels: { label: 'Panels', order: 2 },
  modes: { label: 'Modes', order: 3 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShortcutOverlay() {
  const { shortcuts, overlayOpen, toggleOverlay } = useShortcuts();
  const prefersReducedMotion = useReducedMotion();

  // Listen for custom event from command palette
  useEffect(() => {
    const handler = () => toggleOverlay();
    window.addEventListener('openShortcutsHelp', handler);
    return () => window.removeEventListener('openShortcutsHelp', handler);
  }, [toggleOverlay]);

  // Group shortcuts by category
  const grouped = shortcuts.reduce(
    (acc, shortcut) => {
      const cat = shortcut.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(shortcut);
      return acc;
    },
    {} as Record<ShortcutCategory, typeof shortcuts>,
  );

  // Sort categories by configured order
  const sortedCategories = (Object.keys(grouped) as ShortcutCategory[]).sort(
    (a, b) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order,
  );

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.96 },
        transition: { duration: 0.15, ease: 'easeOut' as const },
      };

  const backdropMotionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.1 },
      };

  return (
    <AnimatePresence>
      {overlayOpen && (
        <motion.div
          key="shortcut-overlay-backdrop"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          {...backdropMotionProps}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-xl"
            onClick={toggleOverlay}
            aria-hidden="true"
          />

          {/* Content */}
          <motion.div
            key="shortcut-overlay-content"
            className={cn(
              'relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto',
              'rounded-2xl border border-border/30',
              'bg-popover/95 backdrop-blur-xl',
              'shadow-2xl shadow-black/30',
              'ring-1 ring-white/5',
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            {...motionProps}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
              <h2 className="text-lg font-semibold text-foreground font-display">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={toggleOverlay}
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-accent/50 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-label="Close shortcuts overlay"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Shortcut groups */}
            <div className="p-6 grid gap-6 sm:grid-cols-2">
              {sortedCategories.map((category) => (
                <div key={category}>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    {CATEGORY_CONFIG[category].label}
                  </h3>
                  <div className="space-y-1">
                    {grouped[category].map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-accent/30 transition-colors"
                      >
                        <span className="text-sm text-foreground/90">{shortcut.label}</span>
                        <ShortcutBadge keys={shortcut.keys} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border/30 text-center">
              <p className="text-[11px] text-muted-foreground/60">
                Press <ShortcutBadge keys="?" inline /> to toggle this overlay
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Shortcut badge (key cap display)
// ---------------------------------------------------------------------------

function ShortcutBadge({ keys, inline }: { keys: string; inline?: boolean }) {
  const formatted = formatShortcutKeys(keys);
  const parts = formatted.split(/([+ ])/);

  return (
    <span className={cn('inline-flex items-center gap-0.5', inline && 'mx-0.5')}>
      {parts.map((part, i) => {
        if (part === '+') {
          return (
            <span key={i} className="text-[10px] text-muted-foreground/40">
              +
            </span>
          );
        }
        if (part === ' ') {
          return (
            <span key={i} className="text-[10px] text-muted-foreground/40 mx-0.5">
              then
            </span>
          );
        }
        return (
          <kbd
            key={i}
            className={cn(
              'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5',
              'rounded border border-border/50 bg-muted/50',
              'font-mono text-[11px] text-muted-foreground',
            )}
          >
            {part}
          </kbd>
        );
      })}
    </span>
  );
}
