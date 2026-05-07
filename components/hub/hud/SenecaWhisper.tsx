'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useHubInsights } from '@/hooks/useHubInsights';

interface SenecaWhisperProps {
  onExpand: () => void;
  className?: string;
}

const CYCLE_INTERVAL_MS = 15_000;

interface SenecaOrbWhisperProps {
  whisper: string;
  onClick: () => void;
  prefersReducedMotion: boolean | null;
}

export function SenecaOrbWhisper({
  whisper,
  onClick,
  prefersReducedMotion,
}: SenecaOrbWhisperProps) {
  return (
    <motion.button
      key="whisper"
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.95 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 8, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClick}
      className={[
        'relative max-w-[280px] max-[1023px]:max-w-[calc(100vw-80px)]',
        'rounded-xl px-3 py-2',
        'bg-black/50 backdrop-blur-xl',
        'border border-white/10',
        'text-sm text-white/80',
        'cursor-pointer',
        'hover:border-white/20 hover:text-white/90',
        'transition-colors duration-150',
      ].join(' ')}
      aria-live="polite"
    >
      {whisper}
      <span
        className={[
          'absolute top-1/2 -right-1.5 -translate-y-1/2',
          'h-3 w-3 rotate-45',
          'bg-black/50 border-r border-t border-white/10',
        ].join(' ')}
        aria-hidden="true"
      />
    </motion.button>
  );
}

export function SenecaWhisper({ onExpand, className }: SenecaWhisperProps) {
  const { insightMap, isLoading, isEnabled } = useHubInsights();
  const [currentIndex, setCurrentIndex] = useState(0);

  const insights = useMemo(() => Array.from(insightMap.values()), [insightMap]);

  // Cycle through insights every 15 seconds
  useEffect(() => {
    if (insights.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length);
    }, CYCLE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [insights.length]);

  // Reset index when insights change
  useEffect(() => {
    setCurrentIndex(0);
  }, [insights.length]);

  if (!isEnabled || isLoading || insights.length === 0) return null;

  const currentInsight = insights[currentIndex];
  if (!currentInsight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 1 }}
      className={[
        'fixed top-20 right-6 z-[12] max-w-xs',
        'bg-[oklch(0.15_0.01_260/0.6)] backdrop-blur-xl',
        'border border-white/[0.08] rounded-xl',
        'p-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />

        <div className="min-w-0 flex flex-col gap-1.5">
          <AnimatePresence mode="wait">
            <motion.p
              key={currentInsight.cardId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-foreground/80 line-clamp-2 leading-relaxed"
            >
              {currentInsight.text}
            </motion.p>
          </AnimatePresence>

          <button
            onClick={onExpand}
            className="text-[10px] text-amber-400/80 hover:text-amber-400 transition-colors self-start"
          >
            Ask Seneca &rarr;
          </button>
        </div>
      </div>
    </motion.div>
  );
}
