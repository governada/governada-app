export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GovernadaProfile } from '@/components/governada/mygov/GovernadaProfile';
import { getValidatedSessionFromCookies } from '@/lib/navigation/session';

export const metadata: Metadata = {
  title: 'Governada — Profile & Settings',
  description: 'Manage your governance identity, notification preferences, and account settings.',
};

export default async function SettingsPage() {
  const session = await getValidatedSessionFromCookies();
  if (!session) {
    redirect('/?connect=1&returnTo=/you/settings');
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <GovernadaProfile />
    </div>
  );
}
