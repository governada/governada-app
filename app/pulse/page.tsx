import { Suspense } from 'react';
import { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { GovernadaPulseOverview } from '@/components/governada/pulse/GovernadaPulseOverview';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Governada — Pulse',
  description:
    "Real-time state of Cardano's on-chain governance — active proposals, treasury activity, DRep participation, and governance health.",
  openGraph: {
    title: 'Governada — Governance Pulse',
    description: "Real-time health of Cardano's on-chain governance.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Governance Pulse',
    description: "Track the real-time state of Cardano's governance.",
  },
};

export const dynamic = 'force-dynamic';

function PulseFallback() {
  return (
    <div className="space-y-6 pt-4">
      <div className="flex gap-1 border-b border-border -mb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PulsePage() {
  return (
    <>
      <PageViewTracker event="pulse_page_viewed" />
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={<PulseFallback />}>
          <GovernadaPulseOverview />
        </Suspense>
      </div>
    </>
  );
}
