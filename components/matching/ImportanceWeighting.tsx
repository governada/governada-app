'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { posthog } from '@/lib/posthog';
import { cn } from '@/lib/utils';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionLabel } from '@/lib/drepIdentity';

/* ─── Types ─────────────────────────────────────────────── */

type ImportanceLevel = 'dealbreaker' | 'important' | 'niceToHave';

interface ImportanceWeightingProps {
  dimensions: string[];
  onWeightsSet: (weights: Record<string, number>) => void;
  onSkip: () => void;
}

/* ─── Constants ─────────────────────────────────────────── */

const WEIGHT_MAP = {
  dealbreaker: 3.0,
  important: 1.0,
  niceToHave: 0.3,
} as const;

const LEVEL_CYCLE: ImportanceLevel[] = ['important', 'dealbreaker', 'niceToHave'];

const LEVEL_CONFIG: Record<ImportanceLevel, { label: string; classes: string; ariaLabel: string }> =
  {
    dealbreaker: {
      label: 'Dealbreaker',
      classes: 'border-red-500/50 bg-red-500/10 text-white',
      ariaLabel: 'Dealbreaker — 3x weight',
    },
    important: {
      label: 'Important',
      classes: 'border-white/20 bg-white/5 text-white/90',
      ariaLabel: 'Important — standard weight',
    },
    niceToHave: {
      label: 'Nice to have',
      classes: 'border-white/10 bg-white/[0.03] text-white/60 opacity-60',
      ariaLabel: 'Nice to have — low weight',
    },
  };

/* ─── Component ─────────────────────────────────────────── */

export function ImportanceWeighting({
  dimensions,
  onWeightsSet,
  onSkip,
}: ImportanceWeightingProps) {
  const prefersReducedMotion = useReducedMotion();

  const [levels, setLevels] = useState<Record<string, ImportanceLevel>>(() => {
    const initial: Record<string, ImportanceLevel> = {};
    for (const dim of dimensions) {
      initial[dim] = 'important';
    }
    return initial;
  });

  const cycleDimension = useCallback((dim: string) => {
    setLevels((prev) => {
      const current = prev[dim] ?? 'important';
      const currentIndex = LEVEL_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % LEVEL_CYCLE.length;
      return { ...prev, [dim]: LEVEL_CYCLE[nextIndex] };
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const weights: Record<string, number> = {};
    let dealbreakers = 0;
    let niceToHaves = 0;
    for (const dim of dimensions) {
      const level = levels[dim] ?? 'important';
      weights[dim] = WEIGHT_MAP[level];
      if (level === 'dealbreaker') dealbreakers++;
      if (level === 'niceToHave') niceToHaves++;
    }
    posthog.capture('match_importance_set', { dealbreakers, niceToHaves });
    onWeightsSet(weights);
  }, [dimensions, levels, onWeightsSet]);

  const getDimLabel = (dim: string): string => {
    try {
      return getDimensionLabel(dim as AlignmentDimension);
    } catch {
      return dim;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        {/* Header */}
        <h3 className="text-lg font-medium text-white">What matters most?</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          This helps us find your best match
        </p>

        {/* Dimension pills */}
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label="Set importance for each governance dimension"
        >
          <AnimatePresence mode="popLayout">
            {dimensions.map((dim) => {
              const level = levels[dim] ?? 'important';
              const config = LEVEL_CONFIG[level];

              return (
                <motion.button
                  key={dim}
                  layout
                  type="button"
                  role="radiogroup"
                  aria-label={`${getDimLabel(dim)}: ${config.ariaLabel}`}
                  className={cn(
                    'relative rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer select-none',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                    config.classes,
                  )}
                  onClick={() => cycleDimension(dim)}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 400, damping: 25 }
                  }
                >
                  <span className="block text-sm font-medium leading-tight">
                    {getDimLabel(dim)}
                  </span>
                  <motion.span
                    key={level}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 500, damping: 30 }
                    }
                    className={cn(
                      'block text-xs mt-0.5',
                      level === 'dealbreaker' && 'text-red-400/80',
                      level === 'important' && 'text-white/50',
                      level === 'niceToHave' && 'text-white/30',
                    )}
                  >
                    {config.label}
                  </motion.span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={handleSubmit} className="w-full">
            Find my matches
          </Button>
          <button
            type="button"
            onClick={() => {
              posthog.capture('match_importance_skipped');
              onSkip();
            }}
            className="text-sm text-muted-foreground hover:text-white/70 transition-colors py-1"
          >
            Skip — equal weights
          </button>
        </div>
      </div>
    </div>
  );
}
