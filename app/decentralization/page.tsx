import { Metadata } from 'next';
import { DecentralizationDashboard } from './DecentralizationDashboard';

export const metadata: Metadata = {
  title: 'Governance Decentralization | DRepScore',
  description:
    "Cardano's governance decentralization measured with the Edinburgh Decentralization Index — 7 metrics tracking voting power distribution, concentration, and diversity.",
};

export default function DecentralizationPage() {
  return (
    <main className="container max-w-5xl py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Governance Decentralization</h1>
        <p className="text-muted-foreground max-w-2xl">
          Measuring Cardano governance decentralization using the Edinburgh Decentralization Index
          methodology — 7 metrics tracking voting power distribution, concentration, and diversity
          across DReps.
        </p>
      </div>
      <DecentralizationDashboard />
    </main>
  );
}
