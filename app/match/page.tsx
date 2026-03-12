import type { Metadata } from 'next';
import { QuickMatchFlow } from '@/components/civica/match/QuickMatchFlow';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Build Your Governance Team — Governada',
  description:
    'Answer 3 questions about what you care about and build your Cardano governance team. Find the DRep and Stake Pool that vote like you. No wallet required.',
  openGraph: {
    title: 'Build Your Governance Team — Governada',
    description: 'Find who votes like you in Cardano governance. 60 seconds, no wallet needed.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Build Your Governance Team — Governada',
    description: 'Find who votes like you in Cardano governance. 60 seconds.',
  },
};

export default function MatchPage() {
  return <QuickMatchFlow />;
}
