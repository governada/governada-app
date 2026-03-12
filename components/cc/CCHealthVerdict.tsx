'use client';

import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
} from 'lucide-react';
import { spring, fadeInUp, staggerContainer } from '@/lib/animations';
import type { CCHealthSummaryResponse } from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Types & Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  healthy: {
    label: 'Healthy',
    icon: ShieldCheck,
    gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
    ringColor: 'text-emerald-500',
    glowColor: 'shadow-emerald-500/20',
    accentBorder: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/15 text-emerald-400',
    arcColor: '#10b981',
    arcTrack: 'rgba(16, 185, 129, 0.12)',
  },
  attention: {
    label: 'Needs Attention',
    icon: ShieldAlert,
    gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
    ringColor: 'text-amber-500',
    glowColor: 'shadow-amber-500/20',
    accentBorder: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/15 text-amber-400',
    arcColor: '#f59e0b',
    arcTrack: 'rgba(245, 158, 11, 0.12)',
  },
  critical: {
    label: 'Critical',
    icon: ShieldX,
    gradient: 'from-rose-500/20 via-rose-500/5 to-transparent',
    ringColor: 'text-rose-500',
    glowColor: 'shadow-rose-500/20',
    accentBorder: 'border-rose-500/30',
    badgeBg: 'bg-rose-500/15 text-rose-400',
    arcColor: '#ef4444',
    arcTrack: 'rgba(239, 68, 68, 0.12)',
  },
} as const;

const TREND_ICON = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
} as const;

const TREND_LABEL = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Declining',
} as const;

// ---------------------------------------------------------------------------
// Arc SVG — the distinctive visual element
// ---------------------------------------------------------------------------

function HealthArc({
  score,
  color,
  trackColor,
}: {
  score: number | null;
  color: string;
  trackColor: string;
}) {
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half-circle
  const normalizedScore = Math.min(100, Math.max(0, score ?? 0));
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

  return (
    <svg
      width={size}
      height={size / 2 + strokeWidth}
      viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}
      className="overflow-visible"
    >
      {/* Track */}
      <path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <motion.path
        d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ ...spring.smooth, duration: 1.2, delay: 0.3 }}
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        className="fill-foreground font-mono text-2xl font-bold"
        style={{ fontSize: 28 }}
      >
        {score ?? '—'}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 14}
        textAnchor="middle"
        className="fill-muted-foreground text-[10px]"
      >
        / 100
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface CCHealthVerdictProps {
  health: CCHealthSummaryResponse;
}

export function CCHealthVerdict({ health }: CCHealthVerdictProps) {
  const config = STATUS_CONFIG[health.status];
  const StatusIcon = config.icon;
  const TrendIcon = TREND_ICON[health.trend];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={`relative overflow-hidden rounded-2xl border ${config.accentBorder} bg-card p-6 sm:p-8 ${config.glowColor} shadow-lg`}
    >
      {/* Background gradient wash */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${config.gradient}`}
      />

      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        {/* Left: Arc + Score */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-col items-center gap-1 sm:min-w-[140px]"
        >
          <HealthArc
            score={health.avgTransparency}
            color={config.arcColor}
            trackColor={config.arcTrack}
          />
          <div
            className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.badgeBg}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {config.label}
          </div>
        </motion.div>

        {/* Right: Narrative */}
        <motion.div variants={fadeInUp} className="flex min-w-0 flex-1 flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
            Constitutional Committee
          </h2>

          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {health.narrative}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {/* Trend */}
            <span className="inline-flex items-center gap-1">
              <TrendIcon className="h-3.5 w-3.5" />
              {TREND_LABEL[health.trend]}
            </span>

            {/* Member count */}
            <span className="inline-flex items-center gap-1">
              <span className="font-mono font-medium text-foreground">{health.activeMembers}</span>{' '}
              active members
            </span>

            {/* Tension indicator */}
            {health.tensionCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-mono font-medium text-foreground">
                  {health.tensionCount}
                </span>{' '}
                CC–DRep tension{health.tensionCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
