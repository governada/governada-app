export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Performance',
  description: 'Your score breakdown, competitive position, and improvement suggestions.',
};

export default function PerformancePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Performance</h1>
      <p className="text-muted-foreground">Performance analytics will appear here.</p>
    </div>
  );
}
