export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FunnelExploreTracker } from '@/components/funnel/FunnelExploreTracker';
import { GovernadaPulseOverview } from '@/components/governada/pulse/GovernadaPulseOverview';
import { Skeleton } from '@/components/ui/skeleton';
import { FeatureGate } from '@/components/FeatureGate';
import { GovernanceTemperature } from '@/components/community/GovernanceTemperature';
import { CitizenMandate } from '@/components/community/CitizenMandate';
import { SentimentDivergence } from '@/components/community/SentimentDivergence';

export const metadata: Metadata = {
  title: 'Governada — Governance Health',
  description:
    "Governance Health Index — is Cardano's governance healthy? GHI score, participation trends, and epoch history.",
  openGraph: {
    title: 'Governada — Governance Health',
    description: "Real-time health of Cardano's on-chain governance.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Governance Health',
    description: "Track the real-time state of Cardano's governance.",
  },
};

function HealthFallback() {
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

export default function HealthPage() {
  return (
    <>
      <PageViewTracker event="governance_health_viewed" />
      <FunnelExploreTracker />
      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
        <Suspense fallback={<HealthFallback />}>
          <GovernadaPulseOverview />
        </Suspense>

        {/* Community Intelligence — all feature-flagged */}
        <FeatureGate flag="governance_temperature">
          <GovernanceTemperature />
        </FeatureGate>

        <div className="grid gap-6 lg:grid-cols-2">
          <FeatureGate flag="community_mandate">
            <CitizenMandate />
          </FeatureGate>

          <FeatureGate flag="sentiment_divergence">
            <SentimentDivergence />
          </FeatureGate>
        </div>
      </div>
    </>
  );
}
