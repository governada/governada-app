export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Constitutional Committee',
  description: 'Constitutional Committee members, transparency index, and accountability records.',
};

/**
 * /governance/committee — placeholder.
 * Will be populated with content migrated from /discover/committee.
 */
export default function CommitteePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Constitutional Committee</h1>
      <p className="text-muted-foreground">CC member directory will appear here.</p>
    </div>
  );
}
