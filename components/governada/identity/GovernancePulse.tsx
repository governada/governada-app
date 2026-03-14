'use client';

import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────────── */

interface GovernancePulseProps {
  pulse: number;
  pulseColor: 'emerald' | 'primary' | 'amber' | 'muted';
  pulseLabel: string;
}

/* ── Color map ──────────────────────────────────────────────────── */

const COLOR_MAP: Record<GovernancePulseProps['pulseColor'], string> = {
  emerald: 'text-emerald-500',
  primary: 'text-primary',
  amber: 'text-amber-500',
  muted: 'text-muted-foreground',
};

/* ── Component ─────────────────────────────────────────────────── */

export function GovernancePulse({ pulse, pulseColor, pulseLabel }: GovernancePulseProps) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-3xl font-bold tabular-nums', COLOR_MAP[pulseColor])}>
        {Math.round(pulse)}
      </span>
      <span className="text-xs text-muted-foreground">/100</span>
      <span className="text-xs text-muted-foreground mt-0.5">{pulseLabel}</span>
    </div>
  );
}
