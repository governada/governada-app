'use client';

import { useRef } from 'react';
import { motion, useInView, useSpring, useTransform } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CredibilityWithLevel } from '@/hooks/useEngagement';

interface EngagementHeroProps {
  credibility: CredibilityWithLevel;
  epoch: number;
}

const levelConfig = {
  Registered: {
    color: 'text-muted-foreground',
    ring: 'stroke-muted-foreground',
    bg: 'bg-muted/50',
    glow: '#64748b',
  },
  Informed: {
    color: 'text-blue-500',
    ring: 'stroke-blue-500',
    bg: 'bg-blue-500/5',
    glow: '#3b82f6',
  },
  Engaged: {
    color: 'text-amber-500',
    ring: 'stroke-amber-500',
    bg: 'bg-amber-500/5',
    glow: '#f59e0b',
  },
  Champion: {
    color: 'text-emerald-500',
    ring: 'stroke-emerald-500',
    bg: 'bg-emerald-500/5',
    glow: '#10b981',
  },
} as const;

export function EngagementHero({ credibility, epoch }: EngagementHeroProps) {
  const level = credibility.engagementLevel?.level ?? 'Registered';
  const progress = credibility.engagementLevel?.progressToNext ?? 0;
  const nextLevel = credibility.engagementLevel?.nextLevel;
  const actionCount = credibility.factors.priorEngagementCount;

  const config = levelConfig[level as keyof typeof levelConfig] ?? levelConfig.Registered;

  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });

  // Animated progress ring
  const circumference = 2 * Math.PI * 28;
  const springProgress = useSpring(0, { stiffness: 60, damping: 18 });
  const strokeOffset = useTransform(
    springProgress,
    (v) => circumference - (v / 100) * circumference,
  );

  // Trigger spring when in view
  if (isInView) {
    springProgress.set(progress);
  }

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border p-5 flex flex-col sm:flex-row items-center gap-5',
        config.bg,
      )}
    >
      {/* Progress Ring with glow */}
      <div className="relative shrink-0">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          className="transform -rotate-90"
          aria-hidden="true"
        >
          <defs>
            <filter id="engagement-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
              <feComposite in2="SourceGraphic" operator="over" />
            </filter>
          </defs>
          <circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke="currentColor"
            className="text-muted/30"
            strokeWidth="4"
          />
          {/* Glow layer */}
          <motion.circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            className={config.ring}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: strokeOffset }}
            filter="url(#engagement-glow)"
            opacity={0.4}
          />
          {/* Crisp ring */}
          <motion.circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            className={config.ring}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: strokeOffset }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-xs font-bold', config.color)}>
            {level.slice(0, 3).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2">
          <p className={cn('font-semibold', config.color)}>{level}</p>
          <Badge variant="outline" className="text-xs tabular-nums">
            {Math.round(credibility.weight * 100)}% weight
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {actionCount > 0 ? (
            <>
              <span className="font-medium text-foreground tabular-nums">{actionCount}</span>{' '}
              governance action{actionCount !== 1 ? 's' : ''} taken
            </>
          ) : (
            'Start participating to build your civic identity'
          )}
        </p>
        {nextLevel && progress < 100 && (
          <p className="text-xs text-muted-foreground">
            {progress}% toward <span className="font-medium">{nextLevel}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">Epoch {epoch}</p>
      </div>
    </div>
  );
}
