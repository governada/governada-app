'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useGovernanceHealthIndex } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { spring } from '@/lib/animations';

interface GHICurrent {
  score: number;
  band: string;
}

interface GHITrend {
  direction: 'up' | 'down' | 'flat';
  delta: number;
  streakEpochs: number;
}

interface GHIData {
  current: GHICurrent;
  trend: GHITrend;
}

const BAND_STYLES: Record<
  string,
  { text: string; ring: string; bg: string; label: string; description: string }
> = {
  strong: {
    text: 'text-emerald-500',
    ring: 'var(--color-emerald-500)',
    bg: 'bg-emerald-500/10',
    label: 'Strong',
    description: 'Cardano governance is highly active with broad participation.',
  },
  good: {
    text: 'text-green-500',
    ring: 'var(--color-green-500)',
    bg: 'bg-green-500/10',
    label: 'Good',
    description: 'Governance is healthy with solid participation across most areas.',
  },
  fair: {
    text: 'text-amber-500',
    ring: 'var(--color-amber-500)',
    bg: 'bg-amber-500/10',
    label: 'Fair',
    description: 'Governance participation is moderate, with room for improvement.',
  },
  critical: {
    text: 'text-rose-500',
    ring: 'var(--color-rose-500)',
    bg: 'bg-rose-500/10',
    label: 'Critical',
    description: 'Governance participation is low. Key areas need attention.',
  },
};

const CIRCUMFERENCE = 2 * Math.PI * 15.5;

export function GHIHero() {
  const { data: rawGhi, isLoading, isError, refetch } = useGovernanceHealthIndex(1);
  const shouldReduceMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div className="flex items-center gap-5 p-5 rounded-xl border border-border bg-card">
        <Skeleton className="h-20 w-20 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
    );
  }

  if (isError || !rawGhi) {
    return (
      <ErrorCard message="Governance Health temporarily unavailable." onRetry={() => refetch()} />
    );
  }

  const ghi = rawGhi as GHIData;
  const score = ghi.current?.score ?? 0;
  const band = ghi.current?.band ?? 'fair';
  const delta = ghi.trend?.delta ?? 0;
  const direction = ghi.trend?.direction ?? 'flat';
  const streakEpochs = ghi.trend?.streakEpochs ?? 0;

  const style = BAND_STYLES[band] ?? BAND_STYLES.fair;
  const scorePct = Math.min(100, Math.max(0, score));
  const strokeOffset = CIRCUMFERENCE * (1 - scorePct / 100);

  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const trendColor =
    direction === 'up'
      ? 'text-emerald-500'
      : direction === 'down'
        ? 'text-rose-500'
        : 'text-muted-foreground';

  const streakLabel =
    streakEpochs > 1
      ? `${streakEpochs}-epoch ${direction === 'up' ? 'climb' : direction === 'down' ? 'slide' : 'streak'}`
      : null;

  return (
    <div
      className={cn(
        'flex items-center gap-5 p-5 rounded-xl border border-border bg-card',
        band === 'strong' &&
          'ring-1 ring-emerald-500/20 shadow-[0_0_15px_-3px] shadow-emerald-500/10',
      )}
    >
      {/* Score ring */}
      <div
        className="relative h-20 w-20 shrink-0"
        role="meter"
        aria-valuenow={Math.round(score)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Governance Health Index: ${Math.round(score)} out of 100`}
      >
        <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-muted/30"
          />
          <motion.circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={style.ring}
            strokeWidth="2.5"
            strokeDasharray={CIRCUMFERENCE}
            strokeLinecap="round"
            initial={{ strokeDashoffset: shouldReduceMotion ? strokeOffset : CIRCUMFERENCE }}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', ...(spring.smooth as object), delay: 0.2 }
            }
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="text-center leading-none">
            <span className="text-2xl font-bold tabular-nums">{Math.round(score)}</span>
            <span className="text-[9px] text-muted-foreground font-medium">/100</span>
          </div>
        </div>
      </div>

      {/* Score context */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">Governance Health</h2>
          <span
            className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', style.bg, style.text)}
          >
            {style.label}
          </span>
          {delta !== 0 && (
            <span
              className={cn('inline-flex items-center gap-0.5 text-xs font-medium', trendColor)}
              aria-label={`Score ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(delta * 10) / 10)} points`}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {delta > 0 ? '+' : ''}
              {Math.round(delta * 10) / 10}
            </span>
          )}
        </div>
        {streakLabel && <p className="text-xs text-muted-foreground">{streakLabel}</p>}
        <p className="text-sm text-muted-foreground">{style.description}</p>
      </div>
    </div>
  );
}
