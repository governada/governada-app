export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { GovernadaProfile } from '@/components/governada/mygov/GovernadaProfile';

export const metadata: Metadata = {
  title: 'Governada — Profile & Settings',
  description: 'Manage your governance identity, notification preferences, and account settings.',
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <GovernadaProfile />
    </div>
  );
}
