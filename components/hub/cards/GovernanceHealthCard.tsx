'use client';

import { Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';

/**
 * GovernanceHealthCard — GHI one-liner with health band.
 *
 * JTBD: "Is Cardano governance healthy right now?"
 * One number, one word verdict, one link to /pulse for details.
 * Like a credit score — not a dashboard.
 */
export function GovernanceHealthCard() {
  const {
    data: ghiRaw,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['ghi-current'],
    queryFn: async () => {
      const res = await fetch('/api/governance/health-index');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <HubCardSkeleton />;
  if (isError)
    return <HubCardError message="Couldn't load governance health" onRetry={() => refetch()} />;

  const ghi = ghiRaw as Record<string, unknown> | undefined;
  const score = (ghi?.score as number) ?? (ghi?.compositeScore as number) ?? 0;
  const rounded = Math.round(score);

  // Health band — like a credit score
  let band: string;
  let urgency: CardUrgency;
  if (rounded >= 70) {
    band = 'Healthy';
    urgency = 'success';
  } else if (rounded >= 50) {
    band = 'Fair';
    urgency = 'warning';
  } else {
    band = 'Needs Attention';
    urgency = 'critical';
  }

  const bandColor =
    urgency === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : urgency === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <HubCard
      href="/governance/health"
      urgency="default"
      label={`Governance health: ${band}, score ${rounded}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Governance Health
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">
            <span className={bandColor}>{band}</span>
          </p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold tabular-nums ${bandColor}`}>{rounded}</span>
          <p className="text-xs text-muted-foreground">GHI</p>
        </div>
      </div>
    </HubCard>
  );
}
