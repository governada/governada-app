import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { LearnClient } from '@/app/learn/LearnClient';

export const metadata: Metadata = {
  title: 'Governada — Help',
  description:
    'Understand Cardano governance: DReps, delegation, proposals, treasury, and how your voice shapes the network.',
  openGraph: {
    title: 'Governada — Help',
    description: 'Everything you need to understand Cardano on-chain governance.',
    type: 'website',
  },
};

export default function HelpPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PageViewTracker event="help_page_viewed" />
      <LearnClient />
    </div>
  );
}
