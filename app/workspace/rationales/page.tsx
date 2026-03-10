export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Rationales',
  description: 'Your published governance rationales and their reception.',
};

export default function RationalesPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Rationales</h1>
      <p className="text-muted-foreground">Your published rationales will appear here.</p>
    </div>
  );
}
