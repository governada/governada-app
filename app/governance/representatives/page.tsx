export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Representatives',
  description:
    'Find and evaluate Cardano DReps. Search, filter, and compare governance representatives.',
};

/**
 * /governance/representatives — placeholder.
 * Will be populated with content migrated from /discover?tab=dreps.
 */
export default function RepresentativesPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Representatives</h1>
      <p className="text-muted-foreground">DRep directory will appear here.</p>
    </div>
  );
}
