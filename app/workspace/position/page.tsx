export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Competitive Position',
  description: 'Your competitive landscape, peer comparison, and governance rankings.',
};

export default function PositionPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Competitive Position</h1>
      <p className="text-muted-foreground">Competitive analysis will appear here.</p>
    </div>
  );
}
