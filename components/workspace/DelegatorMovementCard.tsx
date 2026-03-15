'use client';

import Link from 'next/link';
import { Users, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DelegatorMovementCardProps {
  currentDelegators: number;
  delegatorDelta: number;
  /** Previous epoch delegator count (for % calculation) */
  snapshotDelegators?: number;
}

/**
 * Prominent card surfacing significant delegator movement.
 * Renders only when change exceeds thresholds: >5% change OR >10 absolute.
 */
export function DelegatorMovementCard({
  currentDelegators,
  delegatorDelta,
  snapshotDelegators,
}: DelegatorMovementCardProps) {
  // Edge cases: no meaningful data
  if (currentDelegators <= 0 || delegatorDelta === 0) return null;

  const previousCount = snapshotDelegators ?? currentDelegators - delegatorDelta;

  // Avoid division by zero on first epoch
  if (previousCount <= 0 && delegatorDelta <= 0) return null;

  const pctChange = previousCount > 0 ? Math.abs(delegatorDelta / previousCount) * 100 : 100;

  // Only render when significant: >5% OR >10 absolute
  const absDelta = Math.abs(delegatorDelta);
  if (pctChange <= 5 && absDelta <= 10) return null;

  const isGain = delegatorDelta > 0;
  const Icon = isGain ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-2',
        isGain ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Delegator Movement
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon
            className={cn('h-5 w-5 shrink-0', isGain ? 'text-emerald-500' : 'text-amber-500')}
          />
          <p className="text-sm font-semibold text-foreground">
            {isGain ? '+' : ''}
            {delegatorDelta} delegator{absDelta !== 1 ? 's' : ''} this epoch
            <span className={cn('ml-1.5', isGain ? 'text-emerald-500' : 'text-amber-500')}>
              ({isGain ? '\u2191' : '\u2193'}
              {Math.round(pctChange)}%)
            </span>
          </p>
        </div>

        <Link
          href="/workspace/delegators"
          className={cn(
            'text-xs font-medium shrink-0 inline-flex items-center gap-1 hover:underline',
            isGain ? 'text-emerald-500' : 'text-amber-500',
          )}
        >
          See who arrived <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
