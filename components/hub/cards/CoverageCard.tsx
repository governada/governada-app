'use client';

import { Shield, CheckCircle2, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCard, HubCardSkeleton, HubCardError, type CardUrgency } from './HubCard';

interface CoverageData {
  coveredTypes: number;
  totalTypes: number;
  coveragePct: number;
  hasDrep: boolean;
  hasPool: boolean;
  poolIsGovActive: boolean;
  drepIsActive: boolean;
  gaps: string[];
  alerts: Array<{ type: string; message: string }>;
}

/**
 * CoverageCard — Governance coverage as a two-item checklist.
 *
 * JTBD: "How complete is my governance representation?"
 * Two checkmarks: DRep delegation + Pool delegation.
 * Much clearer than a percentage (which only has 4 possible values).
 * Links to /delegation for the full breakdown.
 */
export function CoverageCard() {
  const { stakeAddress } = useSegment();

  const { data, isLoading, isError, refetch } = useQuery<CoverageData>({
    queryKey: ['governance-coverage', stakeAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/governance/coverage?stakeAddress=${encodeURIComponent(stakeAddress!)}`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!stakeAddress,
    staleTime: 2 * 60 * 1000,
  });

  // Only render for authenticated users
  if (!stakeAddress) return null;

  if (isLoading) return <HubCardSkeleton />;
  if (isError) return <HubCardError message="Couldn't load coverage" onRetry={() => refetch()} />;
  if (!data) return null;

  const { hasDrep, hasPool, drepIsActive, poolIsGovActive } = data;

  const drepOk = hasDrep && drepIsActive;
  const poolOk = hasPool && poolIsGovActive;
  const bothCovered = drepOk && poolOk;
  const noneCovered = !drepOk && !poolOk;

  let urgency: CardUrgency;
  let verdict: string;
  if (bothCovered) {
    urgency = 'default';
    verdict = 'Full coverage';
  } else if (noneCovered) {
    urgency = 'critical';
    verdict = 'No coverage';
  } else {
    urgency = 'warning';
    verdict = 'Partial coverage';
  }

  return (
    <HubCard
      href="/"
      urgency={urgency === 'default' ? 'default' : urgency}
      label={`Representation: ${verdict}`}
    >
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            How Well You&apos;re Represented
          </span>
        </div>

        {/* Two-item checklist */}
        <div className="space-y-1.5">
          <CoverageCheckItem
            label="Your Representative"
            sublabel={
              drepOk
                ? 'Votes on 5 of 7 decision types for you'
                : 'No active representative \u2014 5 decision types with no voice'
            }
            checked={drepOk}
          />
          <CoverageCheckItem
            label="Your Staking Pool"
            sublabel={
              poolOk
                ? 'Covers 2 of 7 decision types'
                : 'No governance-active pool \u2014 2 decision types uncovered'
            }
            checked={poolOk}
          />
        </div>
      </div>
    </HubCard>
  );
}

function CoverageCheckItem({
  label,
  sublabel,
  checked,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      {checked ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500/70" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
      </div>
    </div>
  );
}
