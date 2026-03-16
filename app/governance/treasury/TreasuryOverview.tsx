'use client';

import { TreasuryVerdict } from '@/components/treasury/TreasuryVerdict';
import { NclBudgetBar } from '@/components/treasury/NclBudgetBar';
import { NclUtilizationTrend } from '@/components/treasury/NclUtilizationTrend';
import { TreasuryKeyMetrics } from '@/components/treasury/TreasuryKeyMetrics';
import { TreasuryEpochFlow } from '@/components/treasury/TreasuryEpochFlow';
import { TreasuryPendingProposals } from '@/components/TreasuryPendingProposals';
import { TreasuryAccountabilitySection } from '@/components/TreasuryAccountabilitySection';
import { TreasuryPersonalImpact } from '@/components/treasury/TreasuryPersonalImpact';
import { CitizenDRepStance } from '@/components/treasury/CitizenDRepStance';
import { useDRepTreasuryRecord } from '@/hooks/useDRepTreasuryRecord';
import { useWallet } from '@/utils/wallet';
import dynamic from 'next/dynamic';

const TreasurySimulator = dynamic(
  () =>
    import('@/components/TreasurySimulator').then((m) => ({
      default: m.TreasurySimulator,
    })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" />,
  },
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
import { formatAda } from '@/lib/treasury';
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
 * 4-Level Treasury Overview
 *
 * Level 1 — Verdict: health indicator + inline stats (5-second test)
 * Level 2 — Budget Story: NCL bar + key metrics (the "where")
 * Level 3 — Active Decisions: pending proposals + DRep stance (the "what")
 * Level 4 — Your Impact: personal DRep track record + pending impact (the "you")
 * Deep Dive — Accordions: utilization trend, epoch flow, accountability, simulator
 */
export function TreasuryOverview() {
  const { segment, drepId } = useSegment();
  const { delegatedDrepId } = useWallet();
  const effectiveDrepId = segment === 'drep' ? drepId : delegatedDrepId;
  const { data: rawDrepRecord } = useDRepTreasuryRecord(effectiveDrepId);
  const drepVotes = rawDrepRecord?.record?.votes;

  const { data: rawCurrent } = useTreasuryCurrent();
  const treasury = rawCurrent as TreasuryCurrentData | undefined;

  const { data: rawNcl } = useTreasuryNcl();
  const ncl = (rawNcl as { ncl: NclUtilization | null } | undefined)?.ncl ?? null;

  const { data: rawHistory } = useTreasuryHistory(30);
  const incomeVsOutflow =
    (rawHistory as { incomeVsOutflow: IncomeVsOutflow[] } | undefined)?.incomeVsOutflow ?? [];

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
  const effectivenessRate = rawEffectiveness?.effectivenessRate ?? null;

  const nclImpact = ncl
    ? {
        utilizationPct: ncl.utilizationPct,
        remainingAda: ncl.remainingAda,
        nclAda: ncl.period.nclAda,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ──────────────────────────────────────────────────────────────
          LEVEL 1 — THE VERDICT
          One glanceable health indicator + inline stats.
          Passes the 5-second test on its own.
         ────────────────────────────────────────────────────────────── */}
      <TreasuryVerdict
        balanceAda={balance}
        trend={trend}
        ncl={ncl}
        effectivenessRate={effectivenessRate}
        pendingCount={pendingCount}
        runwayMonths={runway}
      />

      {/* ──────────────────────────────────────────────────────────────
          LEVEL 2 — THE BUDGET STORY
          Where is the money going this period?
         ────────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        {ncl && (
          <p className="text-sm text-muted-foreground">
            The community set a ₳{formatAda(ncl.period.nclAda)} spending limit for epochs{' '}
            {ncl.period.startEpoch}–{ncl.period.endEpoch}. Here&apos;s how it&apos;s being used.
          </p>
        )}

        {ncl && <NclBudgetBar ncl={ncl} />}
        {!ncl && treasury && (
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 text-sm text-muted-foreground">
            No active NCL period. The community has not yet set a spending limit for the current
            epoch range.
          </div>
        )}

        <TreasuryKeyMetrics
          ncl={ncl}
          pendingCount={pendingCount}
          effectivenessRate={effectivenessRate}
        />
      </section>

      {/* ──────────────────────────────────────────────────────────────
          LEVEL 3 — ACTIVE DECISIONS
          What's being decided right now?
         ────────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Active Decisions</h2>

        {/* DRep stance callout (for DReps: your track record as context) */}
        <SegmentGate show={['drep']}>
          {drepId && (
            <div className="mb-4">
              <DRepTreasuryTrackRecord drepId={drepId} />
            </div>
          )}
        </SegmentGate>

        {/* Citizen stance callout: how their delegated DRep votes on treasury */}
        <SegmentGate show={['citizen']}>
          <div className="mb-4">
            <CitizenDRepStance />
          </div>
        </SegmentGate>

        <TreasuryPendingProposals
          treasuryBalanceAda={balance}
          runwayMonths={runway}
          nclImpact={nclImpact}
          drepVotes={drepVotes}
        />
      </section>

      {/* ──────────────────────────────────────────────────────────────
          LEVEL 4 — YOUR IMPACT
          How does this affect you personally?
          Gated to connected users with a DRep.
         ────────────────────────────────────────────────────────────── */}
      <SegmentGate show={['drep', 'citizen']}>
        <TreasuryPersonalImpact
          balanceAda={balance}
          nclRemainingAda={ncl?.remainingAda ?? null}
          nclAda={ncl?.period.nclAda ?? null}
          nclUtilizationPct={ncl?.utilizationPct ?? null}
        />
      </SegmentGate>

      {/* ──────────────────────────────────────────────────────────────
          DEEP DIVE — Analytical depth behind accordions
         ────────────────────────────────────────────────────────────── */}
      <Accordion type="multiple" className="space-y-2">
        {ncl && (
          <AccordionItem
            value="ncl-trend"
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
          >
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              How has spending evolved?
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {Math.round(ncl.utilizationPct)}% used
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <NclUtilizationTrend />
            </AccordionContent>
          </AccordionItem>
        )}

        {incomeVsOutflow.length > 0 && (
          <AccordionItem
            value="epoch-flow"
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
          >
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              Income vs outflow by epoch
            </AccordionTrigger>
            <AccordionContent>
              <TreasuryEpochFlow data={incomeVsOutflow} />
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem
          value="accountability"
          className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
        >
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            Did funded projects deliver?
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
            How long will the treasury last?
          </AccordionTrigger>
          <AccordionContent>
            <TreasurySimulator currentBalance={balance} burnRate={burnRate} currentEpoch={epoch} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
