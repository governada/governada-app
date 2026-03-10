export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { CivicaInbox } from '@/components/civica/mygov/CivicaInbox';

export const metadata: Metadata = {
  title: 'Governada — Inbox',
  description: 'Your governance notifications and action items.',
};

export default function InboxPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <CivicaInbox />
    </div>
  );
}
