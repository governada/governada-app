export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { FunnelExploreTracker } from '@/components/funnel/FunnelExploreTracker';
import { ProposalsBrowse } from '@/components/civica/discover/ProposalsBrowse';

export const metadata: Metadata = {
  title: 'Governada — Proposals',
  description:
    'Active governance proposals in Cardano. See what is being decided, voting deadlines, and stake impact.',
  openGraph: {
    title: 'Governada — Proposals',
    description:
      'Track active governance proposals in Cardano. Voting deadlines, stake impact, and outcomes.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Proposals',
    description: "See what's being decided in Cardano governance.",
  },
};

export default function ProposalsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
      <PageViewTracker event="governance_proposals_viewed" />
      <FunnelExploreTracker />
      <ProposalsBrowse />
    </div>
  );
}
