export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Public Profile',
  description: 'Edit how delegators see your governance profile.',
};

/**
 * /you/public-profile — DRep/SPO only.
 * Edit your public-facing governance profile.
 */
export default function PublicProfilePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Public Profile</h1>
      <p className="text-muted-foreground">Public profile editor will appear here.</p>
    </div>
  );
}
