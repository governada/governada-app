export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Methodology',
  description: 'How governance scores are calculated. Scoring methodology and transparency.',
};

/**
 * /help/methodology — placeholder.
 * Will be populated with content migrated from /methodology.
 */
export default function MethodologyPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Methodology</h1>
      <p className="text-muted-foreground">Scoring methodology will appear here.</p>
    </div>
  );
}
