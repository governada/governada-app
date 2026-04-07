export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CivicIdentityProfile } from '@/components/governada/identity/CivicIdentityProfile';
import { getValidatedSessionFromCookies } from '@/lib/navigation/session';

export const metadata: Metadata = {
  title: 'Governada — Identity',
  description:
    'Your civic identity — delegation history, governance footprint, milestones, and engagement stats.',
  openGraph: {
    title: 'Governada — Your Civic Identity',
    description: 'Your civic identity on Cardano governance.',
    type: 'website',
  },
};

export default async function YouPage() {
  const session = await getValidatedSessionFromCookies();
  if (!session) {
    redirect('/?connect=1&returnTo=/you');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <CivicIdentityProfile />
    </div>
  );
}
