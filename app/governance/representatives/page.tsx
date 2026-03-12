export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FunnelExploreTracker } from '@/components/funnel/FunnelExploreTracker';
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

export default function RepresentativesPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
      <PageViewTracker event="governance_representatives_viewed" />
      <FunnelExploreTracker />
      <CivicaDRepBrowse />
    </div>
  );
}
