export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { TreasuryOverview } from './TreasuryOverview';
import { Skeleton } from '@/components/ui/skeleton';

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
      {/* Balance card skeleton */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-16 w-full" />
      </div>
      {/* Stats row skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
      {/* Pending proposals skeleton */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
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
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <Suspense fallback={<TreasuryFallback />}>
          <TreasuryOverview />
        </Suspense>
      </div>
    </>
  );
}
