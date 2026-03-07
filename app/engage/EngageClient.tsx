'use client';

import { PrioritySignals } from '@/components/engagement/PrioritySignals';
import { CitizenAssembly } from '@/components/engagement/CitizenAssembly';
import { AssemblyHistory } from '@/components/engagement/AssemblyHistory';
import { PageViewTracker } from '@/components/PageViewTracker';

interface EngageClientProps {
  epoch: number;
}

export function EngageClient({ epoch }: EngageClientProps) {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <PageViewTracker event="engage_page_viewed" properties={{ epoch }} />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Civic Engagement</h1>
        <p className="text-muted-foreground mt-1">
          Shape what Cardano governance focuses on. Your signals directly inform DReps and treasury
          teams.
        </p>
      </div>

      {/* Citizen Assembly (if active) */}
      <section>
        <CitizenAssembly />
      </section>

      {/* Priority Signals */}
      <section>
        <PrioritySignals epoch={epoch} />
      </section>

      {/* Past Assemblies */}
      <section>
        <AssemblyHistory />
      </section>
    </div>
  );
}
