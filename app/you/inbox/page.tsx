export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { GovernadaInbox } from '@/components/governada/mygov/GovernadaInbox';

export const metadata: Metadata = {
  title: 'Governada — Inbox',
  description: 'Your governance notifications and action items.',
};

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <GovernadaInbox />
    </div>
  );
}
