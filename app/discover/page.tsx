import { Metadata } from 'next';
import { getAllDReps } from '@/lib/data';
import { HomepageShell } from '@/components/HomepageShell';
import { PageViewTracker } from '@/components/PageViewTracker';

export const metadata: Metadata = {
  title: 'Discover DReps — DRepScore',
  description: 'Find and compare Cardano DReps by score, participation, rationale quality, and alignment with your governance values.',
};

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const { dreps, allDReps, totalAvailable } = await getAllDReps();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-2xl font-bold">Discover DReps</h1>
        <p className="text-sm text-muted-foreground">
          Find Cardano governance representatives aligned with your governance values.
        </p>
      </div>
      <PageViewTracker event="discover_page_viewed" />
      <HomepageShell
        initialDReps={dreps}
        initialAllDReps={allDReps}
        initialTotalAvailable={totalAvailable}
      />
    </div>
  );
}
