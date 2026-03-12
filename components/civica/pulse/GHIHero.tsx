'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useGovernanceHealthIndex } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
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

const BAND_STYLES: Record<string, { text: string; ring: string; bg: string; label: string }> = {
  strong: {
    text: 'text-emerald-500',
    ring: 'var(--color-emerald-500)',
    bg: 'bg-emerald-500/10',
    label: 'Strong',
  },
  good: {
    text: 'text-green-500',
    ring: 'var(--color-green-500)',
    bg: 'bg-green-500/10',
    label: 'Good',
  },
  fair: {
    text: 'text-amber-500',
    ring: 'var(--color-amber-500)',
    bg: 'bg-amber-500/10',
    label: 'Fair',
  },
  critical: {
    text: 'text-rose-500',
    ring: 'var(--color-rose-500)',
    bg: 'bg-rose-500/10',
    label: 'Critical',
  },
};

const CIRCUMFERENCE = 2 * Math.PI * 15.5;

function buildVerdict(
  band: string,
  direction: 'up' | 'down' | 'flat',
  _delta: number,
  streakEpochs: number,
): string {
  const hasStreak = streakEpochs > 1;

  if (band === 'strong') {
    if (direction === 'up')
      return hasStreak
        ? `Governance is thriving \u2014 health has climbed for ${streakEpochs} consecutive epochs.`
        : 'Governance is thriving with broad participation and accountability.';
    if (direction === 'down')
      return 'Still strong, but the trend is cooling. Worth watching this epoch.';
    return 'Governance is in excellent shape across all dimensions.';
  }

  if (band === 'good') {
    if (direction === 'up')
      return hasStreak
        ? `Healthy and improving \u2014 ${streakEpochs} epochs of steady gains.`
        : 'Governance is healthy and trending upward.';
    if (direction === 'down')
      return 'Governance is solid but losing momentum. A few areas need attention.';
    return 'Governance is performing well with room for further growth.';
  }

  if (band === 'fair') {
    if (direction === 'up')
      return 'Governance is recovering. Participation and accountability are on the rise.';
    if (direction === 'down')
      return hasStreak
        ? `Governance has declined for ${streakEpochs} epochs. Key areas need intervention.`
        : 'Governance health is moderate and slipping. Action is needed.';
    return 'Governance participation is moderate, with clear room for improvement.';
  }

  // critical
  if (direction === 'up')
    return 'Signs of recovery are emerging, but governance needs urgent attention.';
  if (direction === 'down')
    return hasStreak
      ? `Governance has been declining for ${streakEpochs} epochs. Immediate action is critical.`
      : 'Governance health is critical and worsening.';
  return 'Governance participation is dangerously low. The ecosystem needs to mobilize.';
}

function buildPersonaAddendum(segment: string, band: string): string | null {
  if (segment === 'drep') {
    if (band === 'critical' || band === 'fair')
      return 'Your votes and rationales directly move this score. Every action counts.';
    return 'Your consistent participation is helping maintain governance health.';
  }
  if (segment === 'spo') {
    if (band === 'critical' || band === 'fair')
      return 'SPO governance participation can help reverse this trend.';
    return null;
  }
  if (segment === 'citizen') {
    if (band === 'critical' || band === 'fair')
      return 'Delegating to an active DRep is the most impactful action you can take.';
    return null;
  }
  if (segment === 'cc') {
    return 'Constitutional Committee oversight shapes the governance environment.';
  }
  return null;
}

export function GHIHero() {
  const { data: rawGhi, isLoading, isError, refetch } = useGovernanceHealthIndex(1);
  const shouldReduceMotion = useReducedMotion();
  const { segment } = useSegment();

  if (isLoading) {
    return (
      <div className="flex items-center gap-5 p-5 rounded-xl border border-border/50 bg-card/70 backdrop-blur-md">
        <Skeleton className="h-[120px] w-[120px] rounded-full shrink-0" />
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

  const verdict = buildVerdict(band, direction, delta, streakEpochs);
  const personaAddendum = buildPersonaAddendum(segment, band);

  return (
    <div
      className={cn(
        'flex items-center gap-5 p-5 rounded-xl border border-border/50 bg-card/70 backdrop-blur-md',
        band === 'strong' &&
          'ring-1 ring-emerald-500/20 shadow-[0_0_15px_-3px] shadow-emerald-500/10',
      )}
    >
      {/* Score ring */}
      <div
        className="relative h-[120px] w-[120px] shrink-0"
        role="meter"
        aria-valuenow={Math.round(score)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Governance Health Index: ${Math.round(score)} out of 100`}
      >
        <svg viewBox="0 0 36 36" className="h-[120px] w-[120px] -rotate-90" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-muted/30"
          />
          {/* Glow circle */}
          {!shouldReduceMotion && (
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={style.ring}
              strokeWidth="3.5"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="animate-[ghi-pulse_3s_ease-in-out_infinite]"
              style={{ filter: 'blur(3px)' }}
            />
          )}
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
            <span className="text-3xl font-bold tabular-nums">{Math.round(score)}</span>
            <span className="text-[10px] text-muted-foreground font-medium">/100</span>
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
        <p className="text-sm text-muted-foreground">{verdict}</p>
        {personaAddendum && <p className="text-xs text-primary/80 mt-1">{personaAddendum}</p>}
      </div>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes ghi-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
