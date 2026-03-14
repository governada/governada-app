export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { SPOScorecardView } from '@/components/governada/identity/SPOScorecardView';

export const metadata: Metadata = {
  title: 'Governada — Pool Scorecard',
  description:
    'Your stake pool governance scorecard — score breakdown, competitive position, and improvement actions.',
  openGraph: {
    title: 'Governada — Pool Scorecard',
    description: 'Your pool governance performance on Cardano.',
    type: 'website',
  },
};

export default function SPOScorecardPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <SPOScorecardView />
    </div>
  );
}
