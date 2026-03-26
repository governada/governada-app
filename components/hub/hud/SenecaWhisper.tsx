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
