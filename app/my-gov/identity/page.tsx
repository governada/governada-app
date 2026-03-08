export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { CivicIdentityProfile } from '@/components/civica/identity/CivicIdentityProfile';

export const metadata: Metadata = {
  title: 'Civica — Civic Identity',
  description:
    'Your civic identity on Cardano. Delegation history, governance footprint, milestones, and engagement stats.',
  openGraph: {
    title: 'Civica — Civic Identity',
    description: 'Your civic identity on Cardano governance.',
    type: 'website',
  },
};

export default function IdentityPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <CivicIdentityProfile />
    </div>
  );
}
