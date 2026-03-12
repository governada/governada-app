export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FunnelExploreTracker } from '@/components/funnel/FunnelExploreTracker';
import { CivicaSPOBrowse } from '@/components/civica/discover/CivicaSPOBrowse';

export const metadata: Metadata = {
  title: 'Governada — Pools',
  description:
    'Find governance-active Cardano stake pools. Sort and filter by governance score and participation.',
  openGraph: {
    title: 'Governada — Pools',
    description:
      'Browse governance-active stake pools on Cardano. Compare governance scores and participation.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Pools',
    description: 'Find governance-active stake pools on Cardano.',
  },
};

export default function PoolsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PageViewTracker event="governance_pools_viewed" />
      <FunnelExploreTracker />
      <CivicaSPOBrowse />
    </div>
  );
}
