export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Inbox',
  description: 'Your governance notifications and alerts.',
};

/**
 * /you/inbox — placeholder.
 * Will be populated with content migrated from /my-gov/inbox.
 */
export default function InboxPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Inbox</h1>
      <p className="text-muted-foreground">Notification history will appear here.</p>
    </div>
  );
}
