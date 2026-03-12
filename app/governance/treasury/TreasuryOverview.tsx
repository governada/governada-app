'use client';

import { TreasuryNarrativeHero } from '@/components/treasury/TreasuryNarrativeHero';
import { NclBudgetBar } from '@/components/treasury/NclBudgetBar';
import { NclUtilizationTrend } from '@/components/treasury/NclUtilizationTrend';
import { TreasuryKeyMetrics } from '@/components/treasury/TreasuryKeyMetrics';
import { TreasuryEpochFlow } from '@/components/treasury/TreasuryEpochFlow';
import { TreasuryPendingProposals } from '@/components/TreasuryPendingProposals';
import { TreasuryAccountabilitySection } from '@/components/TreasuryAccountabilitySection';
import dynamic from 'next/dynamic';

const TreasurySimulator = dynamic(
  () => import('@/components/TreasurySimulator').then((m) => ({ default: m.TreasurySimulator })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" /> },
);
import { DRepTreasuryTrackRecord } from '@/components/treasury/DRepTreasuryTrackRecord';
import { SegmentGate } from '@/components/shared/SegmentGate';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTreasuryCurrent, useTreasuryNcl, useTreasuryHistory } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import type { NclUtilization, IncomeVsOutflow } from '@/lib/treasury';
import { useQuery } from '@tanstack/react-query';

interface TreasuryCurrentData {
  balance: number;
  epoch: number;
  snapshotAt: string;
  runwayMonths: number;
  burnRatePerEpoch: number;
  trend: 'growing' | 'shrinking' | 'stable';
  healthScore: number | null;
  healthComponents: Record<string, number> | null;
  pendingCount: number;
  pendingTotalAda: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Narrative-first treasury overview with NCL budget bar as visual anchor.
 *
 * Layout:
 * 1. Narrative hero — contextual paragraph
 * 2. NCL budget bar — horizontal segmented bar
 * 3. Key metrics — 3-stat row
 * 4. Epoch flow — income vs outflow last 6 epochs
 * 5. Pending proposals — with per-proposal NCL impact
 * 6. [DRep only] Track record
 * 7. Accordion: Spending Accountability
 * 8. Accordion: Runway Projections
 */
export function TreasuryOverview() {
  const { drepId } = useSegment();
  const { data: rawCurrent } = useTreasuryCurrent();
  const treasury = rawCurrent as TreasuryCurrentData | undefined;

  const { data: rawNcl } = useTreasuryNcl();
  const ncl = (rawNcl as { ncl: NclUtilization | null } | undefined)?.ncl ?? null;

  const { data: rawHistory } = useTreasuryHistory(30);
  const incomeVsOutflow =
    (rawHistory as { incomeVsOutflow: IncomeVsOutflow[] } | undefined)?.incomeVsOutflow ?? [];

  // Effectiveness rate for narrative + metrics
  const { data: rawEffectiveness } = useQuery({
    queryKey: ['treasury-effectiveness'],
    queryFn: () => fetchJson<{ effectivenessRate: number | null }>('/api/treasury/effectiveness'),
    staleTime: 5 * 60 * 1000,
  });

  const balance = treasury?.balance ?? 0;
  const burnRate = treasury?.burnRatePerEpoch ?? 0;
  const runway = treasury?.runwayMonths ?? 0;
  const epoch = treasury?.epoch ?? 0;
  const trend = treasury?.trend ?? 'stable';
  const pendingCount = treasury?.pendingCount ?? 0;
  const pendingTotalAda = treasury?.pendingTotalAda ?? 0;
  const effectivenessRate = rawEffectiveness?.effectivenessRate ?? null;

  const epochFlow = incomeVsOutflow;

  const nclImpact = ncl
    ? {
        utilizationPct: ncl.utilizationPct,
        remainingAda: ncl.remainingAda,
        nclAda: ncl.period.nclAda,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* 1. Narrative hero */}
      <TreasuryNarrativeHero
        balanceAda={balance}
        trend={trend}
        effectivenessRate={effectivenessRate}
        pendingCount={pendingCount}
        pendingTotalAda={pendingTotalAda}
        runwayMonths={runway}
        ncl={ncl}
      />

      {/* 2. NCL Budget Bar */}
      {ncl && <NclBudgetBar ncl={ncl} />}
      {!ncl && treasury && (
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 text-sm text-muted-foreground">
          No active NCL period. The community has not yet set a spending limit for the current epoch
          range.
        </div>
      )}

      {/* 3. Key metrics */}
      <TreasuryKeyMetrics
        ncl={ncl}
        pendingCount={pendingCount}
        effectivenessRate={effectivenessRate}
      />

      {/* 4. Epoch flow */}
      {epochFlow.length > 0 && <TreasuryEpochFlow data={epochFlow} />}

      {/* 5. Pending proposals with NCL impact */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Pending Proposals</h2>
        <TreasuryPendingProposals
          treasuryBalanceAda={balance}
          runwayMonths={runway}
          nclImpact={nclImpact}
        />
      </section>

      {/* 6. DRep track record (segment-gated) */}
      <SegmentGate show={['drep']}>
        {drepId && (
          <section>
            <DRepTreasuryTrackRecord drepId={drepId} />
          </section>
        )}
      </SegmentGate>

      {/* 7, 8, 9. Depth sections behind accordion */}
      <Accordion type="multiple" className="space-y-2">
        {ncl && (
          <AccordionItem
            value="ncl-trend"
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
          >
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              Budget Utilization Over Time
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {Math.round(ncl.utilizationPct)}% used
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <NclUtilizationTrend />
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem
          value="accountability"
          className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
        >
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            Spending Accountability
            {effectivenessRate !== null && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {effectivenessRate}% delivered
              </span>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <TreasuryAccountabilitySection />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem
          value="simulator"
          className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
        >
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            Explore Runway Scenarios
          </AccordionTrigger>
          <AccordionContent>
            <TreasurySimulator currentBalance={balance} burnRate={burnRate} currentEpoch={epoch} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
