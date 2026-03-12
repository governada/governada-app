'use client';

/**
 * DiscoveryFab — Floating action button for the Discovery Hub.
 *
 * 48px glassmorphic circle with Compass icon and progress ring.
 * Pulses until first opened. Delayed entrance to avoid fighting page transitions.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/animations';
import { getDiscoveryState } from '@/lib/discovery/state';

interface DiscoveryFabProps {
  onClick: () => void;
  progress: number; // 0-100
}

export function DiscoveryFab({ onClick, progress }: DiscoveryFabProps) {
  const [visible, setVisible] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const state = getDiscoveryState();
  const showPulse = !state.fabPulseStopped && !shouldReduceMotion;

  // Delayed entrance — 2s after mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), shouldReduceMotion ? 0 : 2000);
    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  // Progress ring calculations (SVG)
  const radius = 21;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={spring.snappy}
          onClick={onClick}
          aria-label="Open discovery guide"
          className={cn(
            'fixed z-30 flex items-center justify-center',
            'h-12 w-12 rounded-full',
            'border border-white/[0.08] bg-card/80 backdrop-blur-md shadow-lg',
            'hover:bg-card/95 hover:border-white/[0.15] hover:shadow-xl',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'transition-colors duration-200',
            // Mobile: above bottom nav (56px + 16px gap). Desktop: bottom-right corner
            'bottom-20 right-4 lg:bottom-6 lg:right-6',
          )}
        >
          {/* Progress ring */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
            {/* Background track */}
            <circle
              cx="24"
              cy="24"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted/20"
            />
            {/* Progress arc */}
            {progress > 0 && (
              <circle
                cx="24"
                cy="24"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-primary transition-all duration-500"
              />
            )}
          </svg>

          {/* Icon */}
          <Compass
            className={cn('h-5 w-5 text-primary relative z-10', showPulse && 'animate-cta-pulse')}
          />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
