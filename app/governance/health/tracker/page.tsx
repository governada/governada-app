export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { NorthStarTracker } from '@/components/governada/tracker/NorthStarTracker';

export const metadata: Metadata = {
  title: 'Governada — GHI North Star Tracker',
  description:
    "Track Cardano's Governance Health Index over time. Governada's public accountability metric — measuring whether governance is improving.",
  openGraph: {
    title: 'Governada — GHI North Star Tracker',
    description: "Is Cardano's governance getting healthier? Track the trend.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — GHI North Star Tracker',
    description: "Is Cardano's governance getting healthier? Track the trend.",
  },
};

export default function TrackerPage() {
  return (
    <>
      <PageViewTracker event="page_viewed_ghi_tracker" />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <NorthStarTracker />
      </div>
    </>
  );
}
