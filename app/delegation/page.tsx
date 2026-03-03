import { Metadata } from 'next';
import { DelegationGraph } from '@/components/DelegationGraph';
import { PageViewTracker } from '@/components/PageViewTracker';

export const metadata: Metadata = {
  title: 'Delegation Network — DRepScore',
  description: 'Visualize the Cardano DRep delegation network.',
};

export default function DelegationPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker event="delegation_graph_viewed" />
      <h1 className="text-2xl font-bold tracking-tight">Delegation Network</h1>
      <p className="text-muted-foreground">Visualize how ADA is distributed across DReps.</p>
      <DelegationGraph />
    </div>
  );
}
