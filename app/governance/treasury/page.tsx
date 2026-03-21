export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { TreasuryOverview } from './TreasuryOverview';
import { Skeleton } from '@/components/ui/skeleton';
import { CompassGuide } from '@/components/governada/shared/CompassGuide';
import { PersonalTeaser } from '@/components/governada/shared/PersonalTeaser';
import { AdvisorPanel } from '@/components/governada/shared/AdvisorPanel';

export const metadata: Metadata = {
  title: 'Governada — Treasury',
  description:
    'Cardano treasury balance, spending transparency, pending proposals, and runway projections.',
  openGraph: {
    title: 'Governada — Treasury',
    description:
      'Track Cardano treasury health — balance trends, pending withdrawals, spending effectiveness, and runway scenarios.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Treasury',
    description: 'Cardano treasury spending transparency and health.',
  },
};

function TreasuryFallback() {
  return (
    <div className="space-y-6">
      {/* Narrative hero skeleton */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* NCL budget bar skeleton */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-5 w-full rounded-full" />
        <div className="flex gap-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {/* Key metrics skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-2"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      {/* Pending proposals skeleton */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function TreasuryPage() {
  return (
    <>
      <PageViewTracker event="governance_treasury_viewed" />
      <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
        <CompassGuide page="treasury" />
        <Suspense fallback={<TreasuryFallback />}>
          <TreasuryOverview />
        </Suspense>
        <PersonalTeaser variant="treasury_impact" />
        <AdvisorPanel />
      </div>
    </>
  );
}
