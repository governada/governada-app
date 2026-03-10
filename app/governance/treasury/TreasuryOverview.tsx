'use client';

import { CivicaTreasury } from '@/components/civica/pulse/CivicaTreasury';
import { TreasuryPendingProposals } from '@/components/TreasuryPendingProposals';
import { TreasuryAccountabilitySection } from '@/components/TreasuryAccountabilitySection';
import { TreasurySimulator } from '@/components/TreasurySimulator';
import { useTreasuryCurrent } from '@/hooks/queries';

/**
 * Client-side treasury overview that composes existing treasury components
 * into a cohesive spending transparency page.
 *
 * Data is fetched via TanStack Query hooks inside each child component.
 * We also fetch treasury current here to pass required (but unused) props
 * to components that have them in their interface.
 */
export function TreasuryOverview() {
  const { data: rawCurrent } = useTreasuryCurrent();
  const treasury = rawCurrent as
    | {
        balance?: number;
        balanceAda?: number;
        runwayMonths?: number;
        burnRatePerEpoch?: number;
        currentEpoch?: number;
        [key: string]: unknown;
      }
    | undefined;

  const balance = treasury?.balance ?? treasury?.balanceAda ?? 0;
  const burnRate = treasury?.burnRatePerEpoch ?? 0;
  const runway = treasury?.runwayMonths ?? 0;
  const epoch = treasury?.currentEpoch ?? 0;

  return (
    <div className="space-y-8">
      {/* Balance, sparkline, runway, and quick pending list */}
      <section>
        <CivicaTreasury />
      </section>

      {/* Detailed pending treasury proposals */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Pending Proposals</h2>
        <TreasuryPendingProposals treasuryBalanceAda={balance} runwayMonths={runway} />
      </section>

      {/* Spending effectiveness and accountability ratings */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Spending Accountability</h2>
        <TreasuryAccountabilitySection />
      </section>

      {/* Runway scenario projections */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Runway Projections</h2>
        <TreasurySimulator currentBalance={balance} burnRate={burnRate} currentEpoch={epoch} />
      </section>
    </div>
  );
}
