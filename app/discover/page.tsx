import { Metadata } from 'next';
import { getAllDReps } from '@/lib/data';
import { HomepageShell } from '@/components/HomepageShell';
import { PageViewTracker } from '@/components/PageViewTracker';
import { DiscoverTabs } from '@/components/DiscoverTabs';

export const metadata: Metadata = {
  title: 'Civica — Discover',
  description:
    'Find and compare Cardano DReps, governance-active stake pools, and Constitutional Committee members. Filter by score, tier, and alignment.',
  openGraph: {
    title: 'Civica — Discover Governance',
    description:
      'Browse every DRep, stake pool, and Constitutional Committee member participating in Cardano governance.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civica — Discover Governance',
    description: 'Find the representative that matches your governance values.',
  },
};

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const { dreps, allDReps, totalAvailable } = await getAllDReps();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Discover Governance</h1>
        <p className="text-sm text-muted-foreground">
          Explore DReps, stake pools, and Constitutional Committee members participating in Cardano
          governance.
        </p>
      </div>
      <PageViewTracker event="discover_page_viewed" />
      <DiscoverTabs
        drepsContent={
          <HomepageShell
            initialDReps={dreps}
            initialAllDReps={allDReps}
            initialTotalAvailable={totalAvailable}
          />
        }
      />
    </div>
  );
}
