import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GlobeLayout } from '@/components/globe/GlobeLayout';

export const metadata: Metadata = {
  title: 'Constellation — Governada',
  description:
    'Explore the Cardano governance constellation. Navigate DReps, proposals, stake pools, and constitutional committee members in an interactive 3D view.',
};

export default function GlobeRouteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<GlobeFallback />}>
      <GlobeLayout>{children}</GlobeLayout>
    </Suspense>
  );
}

function GlobeFallback() {
  return (
    <div className="w-full h-[100dvh] bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500/20 to-violet-500/20 animate-pulse mx-auto" />
        <p className="text-sm text-muted-foreground">Loading constellation...</p>
      </div>
    </div>
  );
}
