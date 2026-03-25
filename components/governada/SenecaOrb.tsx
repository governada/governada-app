'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CompassSigil } from '@/components/governada/CompassSigil';

/**
 * Mirrors the SigilState type from CompassSigil.
 * Defined locally to avoid modifying the existing file.
 */
type SigilState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'speaking'
  | 'urgent'
  | 'celebration'
  | 'searching'
  | 'connected';

interface SenecaOrbProps {
  onClick: () => void;
  sigilState?: SigilState;
  accentColor?: string;
  whisper?: string | null;
  onWhisperDismiss?: () => void;
  className?: string;
}

export function SenecaOrb({
  onClick,
  sigilState = 'idle',
  accentColor,
  whisper,
  onWhisperDismiss,
  className,
}: SenecaOrbProps) {
  const prefersReducedMotion = useReducedMotion();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss whisper after 5 seconds
  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (whisper) {
      dismissTimerRef.current = setTimeout(() => {
        onWhisperDismiss?.();
      }, 5000);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [whisper, onWhisperDismiss]);

  const handleWhisperClick = useCallback(() => {
    onWhisperDismiss?.();
    onClick();
  }, [onClick, onWhisperDismiss]);

  return (
    <div
      className={cn(
        'fixed z-40',
        'bottom-20 right-4 lg:bottom-6 lg:right-6',
        'flex items-center gap-2',
        className,
      )}
    >
      {/* Whisper bubble — positioned to the left of the orb */}
      <AnimatePresence>
        {whisper && (
          <motion.button
            key="whisper"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.95 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={handleWhisperClick}
            className={cn(
              'relative max-w-[280px] max-[1023px]:max-w-[calc(100vw-80px)]',
              'rounded-xl px-3 py-2',
              'bg-black/50 backdrop-blur-xl',
              'border border-white/10',
              'text-sm text-white/80',
              'cursor-pointer',
              'hover:border-white/20 hover:text-white/90',
              'transition-colors duration-150',
            )}
            aria-live="polite"
          >
            {whisper}
            {/* Speech bubble tail pointing right toward orb */}
            <span
              className={cn(
                'absolute top-1/2 -right-1.5 -translate-y-1/2',
                'h-3 w-3 rotate-45',
                'bg-black/50 border-r border-t border-white/10',
              )}
              aria-hidden="true"
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Orb button */}
      <motion.button
        onClick={onClick}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center',
          'rounded-full',
          'bg-black/50 backdrop-blur-xl',
          'border border-white/10',
          'hover:border-white/20',
          'transition-colors duration-150',
          'cursor-pointer',
        )}
        role="button"
        aria-label="Open Seneca"
      >
        <CompassSigil state={sigilState} size={28} accentColor={accentColor} />
      </motion.button>
    </div>
  );
}
