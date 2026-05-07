'use client';

import { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CompassSigil } from '@/components/governada/CompassSigil';
import { SenecaOrbWhisper } from '@/components/hub/hud/SenecaWhisper';

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
  onWhisperClick?: () => void;
  pulse?: boolean;
  className?: string;
}

export function SenecaOrb({
  onClick,
  sigilState = 'idle',
  accentColor,
  whisper,
  onWhisperDismiss,
  onWhisperClick,
  pulse = false,
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
    if (onWhisperClick) {
      onWhisperClick();
      return;
    }
    onWhisperDismiss?.();
    onClick();
  }, [onClick, onWhisperClick, onWhisperDismiss]);

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
          <SenecaOrbWhisper
            whisper={whisper}
            onClick={handleWhisperClick}
            prefersReducedMotion={prefersReducedMotion}
          />
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
          'relative flex h-11 w-11 shrink-0 items-center justify-center',
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
        {pulse && !prefersReducedMotion && (
          <motion.span
            className="pointer-events-none absolute -inset-1 rounded-full border border-white/30"
            initial={{ opacity: 0.25, scale: 1 }}
            animate={{ opacity: [0.2, 0.55, 0.2], scale: [1, 1.18, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        )}
        <CompassSigil state={sigilState} size={28} accentColor={accentColor} />
      </motion.button>
    </div>
  );
}
