import { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { LearnClient } from './LearnClient';

export const metadata: Metadata = {
  title: 'Governada — Learn Governance',
  description:
    'Understand Cardano governance: DReps, delegation, proposals, treasury, and how your voice shapes the network.',
  openGraph: {
    title: 'Governada — Learn Governance',
    description: 'Everything you need to understand Cardano on-chain governance.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Learn Governance',
    description: 'Everything you need to understand Cardano on-chain governance.',
  },
};

export default function LearnPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PageViewTracker event="learn_page_viewed" />
      <LearnClient />
    </div>
  );
}
