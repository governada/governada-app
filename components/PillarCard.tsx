'use client';

import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type PillarStatus } from '@/utils/scoring';

interface PillarCardProps {
  label: string;
  value: number;
  weight: string;
  maxPoints: number;
  status: PillarStatus;
  hint: string;
}

const STATUS_CONFIG: Record<
  PillarStatus,
  {
    icon: typeof CheckCircle2;
    badgeLabel: string;
    badgeClass: string;
    iconClass: string;
    barGradient: string;
    accentBorder: string;
  }
> = {
  strong: {
    icon: CheckCircle2,
    badgeLabel: 'Strong',
    badgeClass:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    iconClass: 'text-green-600 dark:text-green-400',
    barGradient: 'from-green-500 to-green-400',
    accentBorder: 'border-l-green-500',
  },
  'needs-work': {
    icon: AlertTriangle,
    badgeLabel: 'Needs Work',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    iconClass: 'text-amber-600 dark:text-amber-400',
    barGradient: 'from-amber-500 to-amber-400',
    accentBorder: 'border-l-amber-500',
  },
  low: {
    icon: AlertCircle,
    badgeLabel: 'Low',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    iconClass: 'text-red-600 dark:text-red-400',
    barGradient: 'from-red-500 to-red-400',
    accentBorder: 'border-l-red-500',
  },
};

function getTierDistance(value: number, status: PillarStatus): string | null {
  if (status === 'strong') return null;
  if (status === 'needs-work') return `${80 - value} pts to Strong`;
  return `${50 - value} pts to Needs Work`;
}

export function PillarCard({ label, value, weight, maxPoints, status, hint }: PillarCardProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const tierDistance = getTierDistance(value, status);
  const contribution = Math.round((value * maxPoints) / 100);

  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-20px' });

  return (
    <div
      ref={ref}
      className={`space-y-2 p-3 rounded-lg bg-card/50 border-l-2 ${config.accentBorder}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.iconClass}`} />
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${config.badgeClass}`}>
            {config.badgeLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {contribution}/{maxPoints} pts
          </span>
          <span className="text-sm text-muted-foreground tabular-nums font-medium">{value}%</span>
        </div>
      </div>
      {/* Progress bar with gradient fill and animated width */}
      <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${config.barGradient} transition-all duration-700 ease-out`}
          style={{ width: isInView ? `${Math.min(100, Math.max(0, value))}%` : '0%' }}
        />
        <div className="absolute top-0 left-[50%] w-px h-full bg-foreground/20" />
        <div className="absolute top-0 left-[80%] w-px h-full bg-foreground/20" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {tierDistance && (
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{tierDistance}</span>
        )}
      </div>
    </div>
  );
}
