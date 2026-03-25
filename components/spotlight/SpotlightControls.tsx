'use client';

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Star, SkipForward, ChevronRight, ChevronLeft, StarOff } from 'lucide-react';
import { hapticSuccess, hapticLight } from '@/lib/haptics';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import type { SpotlightAction } from './types';

interface SpotlightControlsProps {
  onAction: (action: SpotlightAction) => void;
  /** Called when user presses Back (go to previous entity) */
  onBack?: () => void;
  /** Whether the back button should be enabled (false when at first item) */
  canGoBack?: boolean;
  isTracked: boolean;
  /** Delay before buttons stagger in (seconds) */
  delay?: number;
  /** Skip entrance animation */
  immediate?: boolean;
}

/**
 * Quick action buttons for the spotlight card.
 * Desktop: visible buttons with keyboard shortcut hints.
 * Mobile: same buttons, swipe handling is in the parent SwipeHandler.
 */
export function SpotlightControls({
  onAction,
  onBack,
  canGoBack = false,
  isTracked,
  delay = 0,
  immediate = false,
}: SpotlightControlsProps) {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = !immediate && !reducedMotion;

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (canGoBack && onBack) {
            e.preventDefault();
            hapticLight();
            onBack();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          hapticLight();
          onAction('skip');
          break;
        case 'ArrowUp':
          e.preventDefault();
          hapticSuccess();
          onAction('track');
          break;
        case 'Enter':
          e.preventDefault();
          onAction('details');
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAction, onBack, canGoBack]);

  const buttons = [
    {
      action: 'track' as SpotlightAction,
      icon: isTracked ? StarOff : Star,
      label: isTracked ? 'Untrack' : 'Track',
      shortcut: '↑',
      variant: isTracked
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
        : 'border-border/50 text-muted-foreground hover:border-amber-500/30 hover:text-amber-400',
    },
    {
      action: 'skip' as SpotlightAction,
      icon: SkipForward,
      label: 'Skip',
      shortcut: '→',
      variant: 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground',
    },
    {
      action: 'details' as SpotlightAction,
      icon: ChevronRight,
      label: 'Details',
      shortcut: 'Enter',
      variant: 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10',
    },
  ];

  return (
    <motion.div
      className="flex items-center justify-center gap-3"
      variants={shouldAnimate ? staggerContainer : undefined}
      initial={shouldAnimate ? 'hidden' : undefined}
      animate={shouldAnimate ? 'visible' : undefined}
      transition={shouldAnimate ? { delayChildren: delay } : undefined}
    >
      {/* Back button — only rendered when a back handler is provided */}
      {onBack && (
        <motion.button
          variants={shouldAnimate ? fadeInUp : undefined}
          onClick={() => {
            hapticLight();
            onBack();
          }}
          disabled={!canGoBack}
          aria-label="Go back"
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
            canGoBack
              ? 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
              : 'border-border/20 text-muted-foreground/30 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back</span>
          <kbd className="hidden rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60 lg:inline">
            ←
          </kbd>
        </motion.button>
      )}
      {buttons.map(({ action, icon: Icon, label, shortcut, variant }) => (
        <motion.button
          key={action}
          variants={shouldAnimate ? fadeInUp : undefined}
          onClick={() => {
            if (action === 'track') hapticSuccess();
            else hapticLight();
            onAction(action);
          }}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${variant}`}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
          <kbd className="hidden rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/60 lg:inline">
            {shortcut}
          </kbd>
        </motion.button>
      ))}
    </motion.div>
  );
}
