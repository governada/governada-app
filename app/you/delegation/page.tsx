export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { DelegationPage } from '@/components/hub/DelegationPage';

export const metadata: Metadata = {
  title: 'Governada — Delegation Health',
  description:
    'Monitor your delegation coverage — DRep activity, pool governance participation, and coverage analysis.',
  openGraph: {
    title: 'Governada — Delegation Health',
    description: 'Track your governance delegation health on Cardano.',
    type: 'website',
  },
};

export default function DelegationHealthPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <DelegationPage />
    </div>
  );
}
