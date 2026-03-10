export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getAllDReps } from '@/lib/data';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CivicaDRepBrowse } from '@/components/civica/discover/CivicaDRepBrowse';

export const metadata: Metadata = {
  title: 'Governada — Representatives',
  description:
    'Find and evaluate Cardano DReps. Search, filter, and compare governance representatives by score, tier, and alignment.',
  openGraph: {
    title: 'Governada — Representatives',
    description:
      'Browse every DRep participating in Cardano governance. Filter by score, tier, and alignment.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Representatives',
    description: 'Find the representative that matches your governance values.',
  },
};

export default async function RepresentativesPage() {
  const { allDReps, totalAvailable } = await getAllDReps();

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PageViewTracker event="governance_representatives_viewed" />
      <CivicaDRepBrowse dreps={allDReps} totalAvailable={totalAvailable} />
    </div>
  );
}
