'use client';

/**
 * PeekBar — always-visible 40px hint bar on mobile (<1024px).
 *
 * Shows a rotating Seneca ghost prompt when collapsed. Tapping the bar
 * opens the mobile intelligence bottom sheet. Tapping the ghost prompt
 * text opens the sheet in conversation mode with that prompt pre-filled.
 *
 * Positioned fixed at the bottom, above the bottom nav bar.
 * Subtle glassmorphic styling matching the app.
 *
 * Feature-flagged behind `governance_copilot`.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronUp, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSenecaGhostPrompts } from '@/hooks/useSenecaGhostPrompts';
import { useIntelligencePanel } from '@/hooks/useIntelligencePanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeekBarProps {
  /** Handler called when the bar is tapped / swiped up */
  onOpen: () => void;
  /** Handler called when a ghost prompt is tapped — opens sheet in conversation mode */
  onOpenWithPrompt?: (prompt: string) => void;
  /** Whether the sheet is currently open (hide bar when open) */
  isSheetOpen: boolean;
  /** Additional classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeekBar({ onOpen, onOpenWithPrompt, isSheetOpen, className }: PeekBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const { panelRoute } = useIntelligencePanel();
  const { currentPrompt } = useSenecaGhostPrompts(panelRoute);

  // Track prompt changes for crossfade key
  const [displayPrompt, setDisplayPrompt] = useState(currentPrompt);
  const prevPromptRef = useRef(currentPrompt);

  useEffect(() => {
    if (currentPrompt !== prevPromptRef.current) {
      prevPromptRef.current = currentPrompt;
      setDisplayPrompt(currentPrompt);
    }
  }, [currentPrompt]);

  if (isSheetOpen) return null;

  return (
    <motion.div
      className={cn(
        // Fixed at bottom, above bottom nav (bottom-nav is typically 64px)
        'fixed left-0 right-0 z-40 lg:hidden',
        'h-10 flex items-center gap-2 px-3',
        // Glassmorphic
        'bg-background/70 backdrop-blur-xl',
        'border-t border-border/20',
        // Safe area
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
      style={{
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      }}
      initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* Left: Seneca icon + ghost prompt (tappable to open with prompt) */}
      <button
        type="button"
        onClick={() => {
          if (onOpenWithPrompt && displayPrompt) {
            onOpenWithPrompt(displayPrompt);
          } else {
            onOpen();
          }
        }}
        className="flex items-center gap-2 min-w-0 flex-1 text-left"
        aria-label={`Ask Seneca: ${displayPrompt}`}
      >
        <Compass className="h-3.5 w-3.5 shrink-0 text-primary/70" />
        <AnimatePresence mode="wait">
          <motion.span
            key={displayPrompt}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-xs text-muted-foreground/70 truncate italic"
          >
            {displayPrompt}
          </motion.span>
        </AnimatePresence>
      </button>

      {/* Right: expand indicator (opens sheet in briefing mode) */}
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 p-1 -mr-1"
        aria-label="Open governance intelligence panel"
      >
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/50" />
      </button>
    </motion.div>
  );
}
