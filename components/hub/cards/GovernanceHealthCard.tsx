'use client';

import { Activity, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';
import { getBand, GHI_BAND_LABELS, type GHIBand } from '@/lib/ghi/types';

interface GHIComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

/**
 * GovernanceHealthCard — GHI with component breakdown.
 *
 * JTBD: "Is Cardano governance healthy right now?"
 * Score + verdict + top components + weakest area callout.
 * World-class: shows WHY the score is what it is, not just a number.
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
  const components = (ghi?.components as GHIComponent[]) ?? [];

  // Use canonical GHI bands (76/51/26) to match the dedicated health page
  const bandKey: GHIBand = getBand(rounded);
  const band = GHI_BAND_LABELS[bandKey];
  const urgency: CardUrgency =
    bandKey === 'strong'
      ? 'success'
      : bandKey === 'good'
        ? 'default'
        : bandKey === 'fair'
          ? 'warning'
          : 'critical';

  const bandColor =
    urgency === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : urgency === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  // Find weakest and strongest active components (skip disabled ones with value 0 and weight 0)
  const activeComponents = components.filter((c) => c.weight > 0);
  const sorted = [...activeComponents].sort((a, b) => a.value - b.value);
  const weakest = sorted[0];
  const strongest = sorted.at(-1);

  // Short component name for display
  const shortName = (name: string) =>
    name
      .replace('DRep ', '')
      .replace('Governance ', '')
      .replace('Citizen ', '')
      .replace('System ', '');

  return (
    <HubCard
      href="/governance/health"
      urgency="default"
      label={`Governance health: ${band}, score ${rounded}`}
    >
      <div className="space-y-2.5">
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
            <p className="text-xs text-muted-foreground">/ 100</p>
          </div>
        </div>

        {/* Component insights — strongest + weakest */}
        {activeComponents.length > 0 && (
          <div className="space-y-1 border-t border-border pt-2">
            {strongest && strongest.value >= 60 && (
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{shortName(strongest.name)}</span>{' '}
                  leading at {strongest.value}
                </span>
              </div>
            )}
            {weakest && weakest !== strongest && (
              <div className="flex items-center gap-1.5 text-xs">
                {weakest.value < 50 ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{shortName(weakest.name)}</span>{' '}
                  lowest at {weakest.value}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </HubCard>
  );
}
