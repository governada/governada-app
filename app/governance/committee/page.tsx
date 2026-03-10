export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { CommitteeDiscovery } from '@/components/CommitteeDiscovery';

export const metadata: Metadata = {
  title: 'Governada — Constitutional Committee',
  description: 'Constitutional Committee members, transparency index, and accountability records.',
  openGraph: {
    title: 'Governada — Constitutional Committee',
    description: 'Track CC member accountability and transparency on Cardano.',
    type: 'website',
  },
};

export default function CommitteePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PageViewTracker event="governance_committee_viewed" />
      <CommitteeDiscovery />
    </div>
  );
}
