'use client';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreImpactChipProps {
  points: number;
  size?: 'sm' | 'md';
}

export function ScoreImpactChip({ points, size = 'sm' }: ScoreImpactChipProps) {
  if (points === 0) return null;

  const isPositive = points > 0;
  const label = isPositive ? `+${points} pts` : `${points} pts`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full font-mono font-semibold tabular-nums',
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1',
        isPositive
          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
          : 'bg-red-500/10 text-red-500 border border-red-500/20',
      )}
    >
      <Zap className={cn('shrink-0', size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
      {label}
    </span>
  );
}
