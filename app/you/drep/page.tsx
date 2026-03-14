export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { DRepScorecardView } from '@/components/governada/identity/DRepScorecardView';

export const metadata: Metadata = {
  title: 'Governada — DRep Scorecard',
  description: 'Your DRep governance scorecard — score breakdown, improvement actions, and trends.',
  openGraph: {
    title: 'Governada — DRep Scorecard',
    description: 'Your DRep governance performance on Cardano.',
    type: 'website',
  },
};

export default function DRepScorecardPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <DRepScorecardView />
    </div>
  );
}
