export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — You',
  description: 'Your governance identity card. See and share your civic profile.',
};

/**
 * /you — Governance ID summary.
 * Will be populated with shareable governance identity card.
 */
export default function YouPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Governance Identity</h1>
      <p className="text-muted-foreground">
        Your shareable governance identity card will appear here.
      </p>
    </div>
  );
}
