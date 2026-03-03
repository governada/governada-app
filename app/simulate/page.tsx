import { Metadata } from 'next';
import { WhatIfSimulator } from '@/components/WhatIfSimulator';
import { PageViewTracker } from '@/components/PageViewTracker';

export const metadata: Metadata = {
  title: 'What-If Simulator — DRepScore',
  description: 'Compare DReps and simulate delegation outcomes.',
};

export default function SimulatePage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <PageViewTracker event="simulator_viewed" />
      <h1 className="text-2xl font-bold tracking-tight">What-If Simulator</h1>
      <p className="text-muted-foreground">
        Compare DReps and see how a delegation change would affect your governance representation.
      </p>
      <WhatIfSimulator />
    </div>
  );
}
