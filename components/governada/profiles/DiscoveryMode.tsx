'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Users, TrendingUp, TrendingDown, Minus, Heart } from 'lucide-react';
import { InlineQuickMatch } from './InlineQuickMatch';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import type { AlignmentScores } from '@/lib/drepIdentity';

/* ─── Types ───────────────────────────────────────────── */

interface DiscoveryModeProps {
  drepId: string;
  drepName: string;
  delegatorCount: number;
  endorsementCount: number;
  delegationTrend: 'growing' | 'stable' | 'declining';
  onMatchComplete: (alignment: AlignmentScores) => void;
  className?: string;
}

/* ─── Trend display ───────────────────────────────────── */

const TREND_CONFIG = {
  growing: { icon: TrendingUp, label: 'Growing this epoch', className: 'text-emerald-500' },
  stable: { icon: Minus, label: 'Stable this epoch', className: 'text-muted-foreground' },
  declining: { icon: TrendingDown, label: 'Declining this epoch', className: 'text-amber-500' },
} as const;

/* ─── Component ───────────────────────────────────────── */

export function DiscoveryMode({
  drepId,
  drepName,
  delegatorCount,
  endorsementCount,
  delegationTrend,
  onMatchComplete,
  className,
}: DiscoveryModeProps) {
  const { isAtLeast } = useGovernanceDepth();

  // Deep depth users without alignment data — show a prompt to take the quiz
  if (isAtLeast('deep') as boolean) {
    return (
      <div className={cn('rounded-lg border p-6 text-center', className)}>
        <p className="text-muted-foreground">
          Take the{' '}
          <Link href="/match" className="underline">
            Quick Match quiz
          </Link>{' '}
          to see how this DRep aligns with your governance values.
        </p>
      </div>
    );
  }

  const trend = TREND_CONFIG[delegationTrend];
  const TrendIcon = trend.icon;

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Inline Quick Match ── */}
      <InlineQuickMatch drepName={drepName} drepId={drepId} onMatchComplete={onMatchComplete} />

      {/* ── Social Proof Section ── */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-4 space-y-2">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary/70" />
            <span className="font-medium text-foreground tabular-nums">
              {delegatorCount.toLocaleString()}
            </span>{' '}
            citizens have delegated
          </span>
          <span className={cn('flex items-center gap-1', trend.className)}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span className="text-xs">{trend.label}</span>
          </span>
        </div>

        {endorsementCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Heart className="h-4 w-4 text-primary/70" />
            <span className="font-medium text-foreground tabular-nums">
              {endorsementCount}
            </span>{' '}
            citizen endorsements
          </div>
        )}
      </div>
    </div>
  );
}
